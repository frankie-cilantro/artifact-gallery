"""Rebuild gitignored raw parquets from the committed processed CSVs.

Fresh containers don't carry data/raw (gitignored); the IIHS side is already
validated, so the committed data/processed CSVs are the durable source. This
puts the parquets back where the loaders expect them without re-hitting IIHS.
"""
from __future__ import annotations

import pandas as pd

from ..config import DATA, RAW


def run() -> None:
    dr_dir = RAW / "iihs_death_rates"
    dr_dir.mkdir(parents=True, exist_ok=True)
    dr = pd.read_csv(DATA / "processed" / "death_rates.csv")
    dr.to_parquet(dr_dir / "death_rates.parquet", index=False)
    agg = pd.read_csv(DATA / "processed" / "death_rate_aggregates.csv")
    agg.to_parquet(dr_dir / "death_rate_aggregates.parquet", index=False)
    rt_dir = RAW / "iihs_ratings"
    rt_dir.mkdir(parents=True, exist_ok=True)
    rt = pd.read_csv(DATA / "processed" / "ratings.csv")
    rt.to_parquet(rt_dir / "ratings.parquet", index=False)
    print(f"rehydrated: {len(dr)} death rates, {len(agg)} aggregates, {len(rt)} ratings")


if __name__ == "__main__":
    run()
