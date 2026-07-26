"""FARS (Fatality Analysis Reporting System) annual files.

Downloads the ACCIDENT / VEHICLE / PERSON tables per year (2015+) and writes
one parquet per table-year. Crash-level detail (impact point, speed limit,
road class, restraint, alcohol, driver age/sex) is what lets the analysis
condition on crash occurrence.
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pandas as pd

from ..config import FARS_BASE, FARS_YEARS, RAW
from .common import fetch

OUT = RAW / "fars"
TABLES = ["accident", "vehicle", "person"]

KEEP = {
    "accident": ["ST_CASE", "YEAR", "FUNC_SYS", "SP_LIMIT", "VE_TOTAL",
                 "HOUR", "LGT_COND"],
    "vehicle": ["ST_CASE", "VEH_NO", "VIN", "MAKE", "MODEL", "MOD_YEAR",
                "IMPACT1", "ROLLOVER", "DEATHS", "VSPD_LIM"],
    "person": ["ST_CASE", "VEH_NO", "PER_NO", "PER_TYP", "AGE", "SEX",
               "INJ_SEV", "REST_USE", "DRINKING", "SEAT_POS"],
}


def _read_table(zf: zipfile.ZipFile, table: str) -> pd.DataFrame:
    name = next((n for n in zf.namelist() if n.lower().startswith(table) and
                 n.lower().endswith(".csv")), None)
    if name is None:
        raise FileNotFoundError(f"{table}.csv not in zip: {zf.namelist()[:10]}")
    df = pd.read_csv(zf.open(name), encoding="latin-1", low_memory=False)
    df.columns = [c.upper() for c in df.columns]
    cols = [c for c in KEEP[table] if c in df.columns]
    return df[cols]


def run(years=FARS_YEARS) -> Path:
    OUT.mkdir(parents=True, exist_ok=True)
    for year in years:
        done = OUT / f"person_{year}.parquet"
        if done.exists():
            print(f"FARS {year}: cached")
            continue
        url = f"{FARS_BASE}/{year}/National/FARS{year}NationalCSV.zip"
        raw = fetch(url, name=f"fars_{year}", ext=".zip")
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            for table in TABLES:
                df = _read_table(zf, table)
                if "YEAR" not in df.columns:
                    df["YEAR"] = year
                df.to_parquet(OUT / f"{table}_{year}.parquet", index=False)
        print(f"FARS {year}: done")
    return OUT
