"""CRSS (Crash Report Sampling System) — police-reported crash involvements.

This is the denominator in P(death | involved): the step everyone skips and
the step that matters. CRSS is a complex survey sample — the WEIGHT column is
mandatory downstream; raw counts are never valid involvement counts.
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pandas as pd

from ..config import CRSS_BASE, FARS_YEARS, RAW
from .common import fetch

OUT = RAW / "crss"

KEEP_VEHICLE = ["CASENUM", "VEH_NO", "VIN", "MAKE", "MODEL", "MOD_YEAR",
                "IMPACT1", "ROLLOVER", "WEIGHT"]
KEEP_PERSON = ["CASENUM", "VEH_NO", "PER_NO", "PER_TYP", "AGE", "SEX",
               "INJ_SEV", "REST_USE", "SEAT_POS", "WEIGHT"]
KEEP_ACCIDENT = ["CASENUM", "VE_TOTAL", "SP_LIMIT", "FUNC_SYS", "WEIGHT"]


def run(years=FARS_YEARS) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    for year in years:
        if year < 2016:
            continue  # CRSS starts 2016 (NASS/GES before that)
        if (OUT / f"person_{year}.parquet").exists():
            print(f"CRSS {year}: cached")
            continue
        url = f"{CRSS_BASE}/{year}/CRSS{year}CSV.zip"
        raw = fetch(url, name=f"crss_{year}", ext=".zip")
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for table, keep in [("accident", KEEP_ACCIDENT),
                                ("vehicle", KEEP_VEHICLE),
                                ("person", KEEP_PERSON)]:
                name = next(n for n in zf.namelist()
                            if n.lower().startswith(table) and n.lower().endswith(".csv"))
                df = pd.read_csv(zf.open(name), encoding="latin-1", low_memory=False)
                df.columns = [c.upper() for c in df.columns]
                df = df[[c for c in keep if c in df.columns]]
                df["YEAR"] = year
                assert "WEIGHT" in df.columns, \
                    f"CRSS {table} {year} missing survey WEIGHT — unusable as denominator"
                df.to_parquet(OUT / f"{table}_{year}.parquet", index=False)
        print(f"CRSS {year}: done")
    return OUT
