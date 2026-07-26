"""IIHS driver death rates by make and model.

Primary path (verified working 2026-07): the ratings page is a Vue shell; the
grid POSTs to /api/driver-death-rates/get-view-model with year/style/size GUID
params. An unfiltered first POST returns the option lists (Years, Styles,
Sizes); we then sweep every combination and collect the Info rows plus the
Total/Subtotal aggregates (used by validation gate 1/2).

Fallback path: parse the Status Report PDFs with pdfplumber (NOT pypdf).

Units: driver deaths per million registered vehicle years (MRVY).
CI bounds are always kept — many "0" entries have upper bounds of 20-35, and
discarding them produces false precision.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import pandas as pd
import requests

from ..config import RAW, STUDY_CYCLES
from .common import snapshot

OUT = RAW / "iihs_death_rates"
API = "https://www.iihs.org/api/driver-death-rates/get-view-model"

COLUMNS = ["cycle", "nameplate", "class", "drivetrain", "model_years",
           "rate_overall", "ci_lo", "ci_hi", "rate_mv", "rate_sv",
           "rate_sv_roll", "exposure_rvy"]

_DT_IN_NAME = re.compile(r"\b(2WD|4WD|AWD)\b", re.I)

# e.g. "Chevrolet Spark  minicar  2017-20  141 (85-224)  63  78  47"
_PDF_ROW = re.compile(
    r"^(?P<name>.+?)\s{2,}(?P<years>\d{4}(?:-\d{2,4})?)\s+"
    r"(?P<overall>\d+)\s*\((?P<lo>\d+)[-–](?P<hi>\d+)\)\s+"
    r"(?P<mv>\d+)\s+(?P<sv>\d+)\s+(?P<svr>\d+)"
)


def _post(session: requests.Session, query: dict) -> dict:
    r = session.post(API, json={"query": query},
                     headers={"Accept": "application/json"}, timeout=60)
    r.raise_for_status()
    return r.json()


def _row(rec: dict, cycle: str, cls: str) -> dict:
    name = rec["Vehicle"]
    m = _DT_IN_NAME.search(name)
    drivetrain = m.group(1).upper() if m else ""
    return {
        "cycle": cycle,
        "nameplate": _DT_IN_NAME.sub("", name).replace("  ", " ").strip(),
        "class": cls,
        "drivetrain": drivetrain,
        "model_years": rec.get("ModelYearSpan"),
        "rate_overall": rec.get("OverallDeathRate"),
        "ci_lo": rec.get("Lcl"),
        "ci_hi": rec.get("Ucl"),
        "rate_mv": rec.get("MultiVehicleDeathRate"),
        "rate_sv": rec.get("SingleVehicleDeathRate"),
        "rate_sv_roll": rec.get("RolloverDeathRate"),
        "exposure_rvy": rec.get("RegistrationYears"),
    }


def pull_endpoint(session: requests.Session | None = None
                  ) -> tuple[pd.DataFrame, pd.DataFrame] | None:
    """Sweep year x style x size. Returns (vehicle_rows, aggregate_rows) or
    None if the endpoint is unreachable/gated."""
    s = session or requests.Session()
    try:
        seed = _post(s, {})
    except (requests.RequestException, json.JSONDecodeError):
        return None
    snapshot("iihs_death_rates", json.dumps(seed).encode(),
             {"url": API, "ext": ".json", "note": "seed view-model"})

    years = [(o["Text"], o["Value"]) for o in seed["Years"]]
    styles = [(o["Text"], o["Value"]) for o in seed["Styles"]]
    sizes = [(o["Text"], o["Value"]) for o in seed["Sizes"]]

    rows, aggs = [], []
    for ytext, yval in years:
        cycle = f"MY{ytext}"
        for stext, sval in styles:
            for ztext, zval in sizes:
                d = _post(s, {"DriverDeathRate": yval, "VehicleStyleId": sval,
                              "VehicleSizeId": zval,
                              "SortColumn": "overallDeathRate"})
                time.sleep(0.15)
                cls = (d.get("Subtotal") or {}).get("Vehicle") or f"{ztext} {stext}"
                cls = re.sub(r"^All \d{4} ", "", cls)
                for rec in d.get("Info") or []:
                    rows.append(_row(rec, cycle, cls))
                if d.get("Subtotal"):
                    aggs.append({**_row(d["Subtotal"], cycle, cls), "level": "class"})
        # fleet total is identical across style/size queries; take the last
        if d.get("Total"):
            aggs.append({**_row(d["Total"], cycle, "all"), "level": "fleet"})
    if not rows:
        return None
    return (pd.DataFrame(rows, columns=COLUMNS).drop_duplicates(),
            pd.DataFrame(aggs).drop_duplicates())


def parse_status_report_pdf(pdf_path: Path, cycle: str) -> pd.DataFrame:
    """Fallback: extract the complete death-rate table from a Status Report PDF."""
    import pdfplumber

    rows = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            for line in text.splitlines():
                m = _PDF_ROW.match(line.strip())
                if not m:
                    continue
                name = m["name"].strip()
                drivetrain = ""
                dm = _DT_IN_NAME.search(name)
                if dm:
                    drivetrain = dm.group(1).upper()
                    name = _DT_IN_NAME.sub("", name).strip()
                rows.append({
                    "cycle": cycle, "nameplate": name, "class": "",
                    "drivetrain": drivetrain, "model_years": m["years"],
                    "rate_overall": int(m["overall"]),
                    "ci_lo": int(m["lo"]), "ci_hi": int(m["hi"]),
                    "rate_mv": int(m["mv"]), "rate_sv": int(m["sv"]),
                    "rate_sv_roll": int(m["svr"]), "exposure_rvy": None,
                })
    if not rows:
        raise ValueError(f"no death-rate rows parsed from {pdf_path}; "
                         "check the regex against this report's layout")
    return pd.DataFrame(rows, columns=COLUMNS)


def run() -> Path:
    result = pull_endpoint()
    if result is not None:
        df, aggs = result
    else:
        pdfs = sorted((RAW / "status_reports").glob("*.pdf"))
        if not pdfs:
            raise SystemExit(
                "IIHS endpoint gated and no Status Report PDFs found.\n"
                "Download the reports listed in config.STUDY_CYCLES into "
                f"{RAW / 'status_reports'}/ named like MY2020.pdf, then re-run.\n"
                f"Cycles: {json.dumps({k: v['status_report'] for k, v in STUDY_CYCLES.items()}, indent=2)}"
            )
        df = pd.concat([parse_status_report_pdf(p, p.stem) for p in pdfs],
                       ignore_index=True)
        aggs = pd.DataFrame()
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "death_rates.parquet"
    df.to_parquet(out, index=False)
    if not aggs.empty:
        aggs.to_parquet(OUT / "death_rate_aggregates.parquet", index=False)
    snapshot("iihs_death_rates", df.to_csv(index=False).encode(),
             {"ext": ".csv", "rows": len(df), "note": "normalized"})
    print(f"death rates: {len(df)} vehicle rows, {len(aggs)} aggregates -> {out}")
    return out
