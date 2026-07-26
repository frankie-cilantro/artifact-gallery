"""IIHS driver death rates by make and model.

Primary path: the ratings page is a JS shell; the data grid fetches a JSON
payload via XHR. We hit that endpoint directly and snapshot the raw response.
Fallback path: parse the Status Report PDFs with pdfplumber (NOT pypdf — the
tables need layout-aware extraction).

Units: driver deaths per million registered vehicle years (MRVY).
CI bounds are always kept — many "0" entries have upper bounds of 20-35, and
discarding them produces false precision.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
import requests

from ..config import DEATH_RATE_ENDPOINT, RAW, STUDY_CYCLES
from .common import fetch, snapshot

OUT = RAW / "iihs_death_rates"

COLUMNS = ["cycle", "nameplate", "class", "drivetrain", "model_years",
           "rate_overall", "ci_lo", "ci_hi", "rate_mv", "rate_sv",
           "rate_sv_roll", "exposure_rvy"]

# e.g. "Chevrolet Spark  minicar  2WD  2017-20  141 (85-224)  63  78  47"
_PDF_ROW = re.compile(
    r"^(?P<name>.+?)\s{2,}(?P<years>\d{4}(?:-\d{2,4})?)\s+"
    r"(?P<overall>\d+)\s*\((?P<lo>\d+)[-–](?P<hi>\d+)\)\s+"
    r"(?P<mv>\d+)\s+(?P<sv>\d+)\s+(?P<svr>\d+)"
)


def pull_endpoint(session: requests.Session | None = None) -> pd.DataFrame | None:
    """Try the JSON endpoint the grid uses. Returns None if gated/moved."""
    try:
        raw = fetch(DEATH_RATE_ENDPOINT, name="iihs_death_rates", ext=".json",
                    session=session,
                    headers={"Accept": "application/json",
                             "Referer": "https://www.iihs.org/ratings/driver-death-rates-by-make-and-model"})
        payload = json.loads(raw)
    except (requests.RequestException, json.JSONDecodeError):
        return None
    rows = []
    for rec in payload if isinstance(payload, list) else payload.get("results", []):
        rows.append({
            "cycle": rec.get("studyYear") or rec.get("cycle"),
            "nameplate": rec.get("vehicleName") or rec.get("name"),
            "class": (rec.get("vehicleClass") or "").lower(),
            "drivetrain": rec.get("driveType") or "",
            "model_years": rec.get("modelYears"),
            "rate_overall": rec.get("overallRate"),
            "ci_lo": rec.get("confidenceLow"),
            "ci_hi": rec.get("confidenceHigh"),
            "rate_mv": rec.get("multiVehicleRate"),
            "rate_sv": rec.get("singleVehicleRate"),
            "rate_sv_roll": rec.get("rolloverRate"),
            "exposure_rvy": rec.get("exposure"),
        })
    return pd.DataFrame(rows, columns=COLUMNS) if rows else None


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
                dm = re.search(r"\b(2WD|4WD|AWD)\b", name)
                if dm:
                    drivetrain = dm.group(1)
                    name = name[: dm.start()].strip()
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
    df = pull_endpoint()
    if df is None:
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
    out = OUT / "death_rates.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    snapshot("iihs_death_rates", df.to_csv(index=False).encode(),
             {"ext": ".csv", "rows": len(df), "note": "normalized"})
    print(f"death rates: {len(df)} rows -> {out}")
    return out
