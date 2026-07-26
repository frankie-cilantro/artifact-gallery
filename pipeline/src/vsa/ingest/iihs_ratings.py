"""IIHS per-vehicle crashworthiness ratings.

One page per make/model/year. Ratings are encoded ordinal (Good=4 ... Poor=1)
with the raw string kept alongside. Continuous measurements (B-pillar
intrusion, structural components) are captured where published — they carry
more signal than the collapsed ordinal rating.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd
import requests

from ..config import RATING_ORD, RAW
from .common import fetch

OUT = RAW / "iihs_ratings"
API = "https://www.iihs.org/api/ratings/vehicle"  # verify per pull via DevTools; snapshotted

TESTS = [
    "moderate_overlap_front", "moderate_overlap_front_updated",
    "small_overlap_driver", "small_overlap_passenger",
    "side_original", "side_updated", "roof_strength", "head_restraints",
    "front_crash_prevention_v2v", "front_crash_prevention_v2p", "headlights",
]


def _norm_test(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    aliases = {
        "moderate_overlap_front_original": "moderate_overlap_front",
        "side_original_test": "side_original",
        "side_updated_test": "side_updated",
        "front_crash_prevention_vehicle_to_vehicle": "front_crash_prevention_v2v",
        "front_crash_prevention_vehicle_to_pedestrian": "front_crash_prevention_v2p",
    }
    return aliases.get(s, s)


def parse_vehicle_payload(payload: dict, nameplate: str, rating_year: int) -> list[dict]:
    rows = []
    for t in payload.get("tests", []):
        raw = t.get("rating") or t.get("overallRating")
        rows.append({
            "nameplate": nameplate,
            "rating_year": rating_year,
            "test_name": _norm_test(t.get("name", "")),
            "rating_raw": raw,
            "rating_ord": RATING_ORD.get(raw),
            "measurement_value": t.get("measurement") or t.get("intrusion_cm"),
        })
    for award in payload.get("awards", []):
        rows.append({
            "nameplate": nameplate, "rating_year": award.get("year", rating_year),
            "test_name": "award", "rating_raw": award.get("level"),  # TSP / TSP+
            "rating_ord": None, "measurement_value": None,
        })
    return rows


def run(vehicles: pd.DataFrame | None = None) -> Path:
    """`vehicles` = death-rate nameplates to fetch; defaults to the ingested set."""
    if vehicles is None:
        dr = RAW / "iihs_death_rates" / "death_rates.parquet"
        if not dr.exists():
            raise SystemExit("run ingest-iihs-death-rates first (need the nameplate list)")
        vehicles = pd.read_parquet(dr)[["nameplate", "model_years"]].drop_duplicates()

    session = requests.Session()
    rows, failures = [], []
    for _, v in vehicles.iterrows():
        year = int(str(v["model_years"])[:4])
        try:
            raw = fetch(f"{API}?name={requests.utils.quote(v['nameplate'])}&year={year}",
                        name="iihs_ratings", ext=".json", session=session)
            rows += parse_vehicle_payload(json.loads(raw), v["nameplate"], year)
        except Exception as e:  # noqa: BLE001 — collect, report, keep going
            failures.append((v["nameplate"], year, str(e)))

    if failures:
        print(f"WARNING: {len(failures)} ratings fetches failed; first 5: {failures[:5]}")
    if not rows:
        raise SystemExit("no ratings retrieved — endpoint likely moved; "
                         "re-capture via DevTools and update API in iihs_ratings.py")
    df = pd.DataFrame(rows)
    out = OUT / "ratings.parquet"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out, index=False)
    print(f"ratings: {len(df)} test rows -> {out}")
    return out
