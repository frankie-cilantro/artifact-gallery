"""Entity resolution: IIHS nameplate <-> FARS make/model codes <-> vPIC body class.

The three vocabularies do not agree; this is where most build time goes.
Policy: every IIHS death-rate row MUST resolve, or the pipeline fails loudly.
Silent drops bias the sample toward high-volume mainstream models.
"""
from __future__ import annotations

import re

import pandas as pd

from .config import CROSSWALK_CSV, RAW

REQUIRED_COLS = ["iihs_name", "fars_make_code", "fars_model_code",
                 "vpic_body_class", "drivetrain", "class", "luxury_flag"]

_DRIVETRAIN = {
    "2wd": "2WD", "fwd": "2WD", "rwd": "2WD",
    "4wd": "4WD", "4x4": "4WD",
    "awd": "AWD", "quattro": "AWD", "xdrive": "AWD", "4matic": "AWD",
    "4motion": "AWD", "sh-awd": "AWD",
}

_BODY = {
    "sedan": "sedan", "saloon": "sedan", "4-door": "sedan", "4 dr": "sedan",
    "coupe": "coupe", "2-door": "coupe",
    "hatchback": "hatchback", "wagon": "wagon", "estate": "wagon",
    "crew cab": "crew cab", "double cab": "crew cab", "supercrew": "crew cab",
    "extended cab": "extended cab", "supercab": "extended cab",
    "short bed": "short bed", "long bed": "long bed",
}


def norm_drivetrain(token: str) -> str:
    return _DRIVETRAIN.get(str(token).strip().lower(), str(token).strip().upper())


def norm_body(token: str) -> str:
    t = str(token).strip().lower()
    for k, v in _BODY.items():
        if k in t:
            return v
    return t


def explode_model_years(df: pd.DataFrame, span_col: str = "model_years") -> pd.DataFrame:
    """IIHS pools up to 3 prior model years ('2017-20' is one row). Explode to
    individual years for FARS joins; re-aggregate after."""
    out = []
    for _, row in df.iterrows():
        span = str(row[span_col])
        m = re.match(r"(\d{4})(?:[-–](\d{2,4}))?", span)
        if not m:
            raise ValueError(f"unparseable model-year span: {span!r}")
        start = int(m.group(1))
        end = m.group(2)
        end = start if end is None else (int(end) if len(end) == 4
                                         else start // 100 * 100 + int(end))
        for y in range(start, end + 1):
            r = row.to_dict()
            r["model_year"] = y
            out.append(r)
    return pd.DataFrame(out)


def load_crosswalk() -> pd.DataFrame:
    xw = pd.read_csv(CROSSWALK_CSV, dtype=str, comment="#")
    missing = set(REQUIRED_COLS) - set(xw.columns)
    if missing:
        raise SystemExit(f"crosswalk.csv missing columns: {sorted(missing)}")
    xw["drivetrain"] = xw["drivetrain"].map(norm_drivetrain)
    dupes = xw[xw.duplicated(["iihs_name", "drivetrain"], keep=False)]
    if not dupes.empty:
        raise SystemExit(f"duplicate crosswalk keys:\n{dupes[['iihs_name', 'drivetrain']]}")
    return xw


def resolve() -> pd.DataFrame:
    """Join death rates against the crosswalk; fail loudly on any unresolved row."""
    dr = pd.read_parquet(RAW / "iihs_death_rates" / "death_rates.parquet")
    dr["drivetrain"] = dr["drivetrain"].map(norm_drivetrain)
    # the crosswalk's class assignment is authoritative (PDF-parsed pulls
    # often lack it entirely)
    dr = dr.drop(columns=["class"], errors="ignore")
    xw = load_crosswalk()
    merged = dr.merge(xw, left_on=["nameplate", "drivetrain"],
                      right_on=["iihs_name", "drivetrain"], how="left",
                      indicator=True)
    unresolved = merged[merged["_merge"] == "left_only"]
    if not unresolved.empty:
        listing = unresolved[["nameplate", "drivetrain", "cycle"]].to_string(index=False)
        raise SystemExit(
            f"ENTITY RESOLUTION FAILED — {len(unresolved)} IIHS rows unresolved.\n"
            f"Silent drops bias toward mainstream models; add these to "
            f"{CROSSWALK_CSV}:\n{listing}"
        )
    return merged.drop(columns=["_merge"])
