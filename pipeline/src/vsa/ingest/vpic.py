"""NHTSA vPIC batch VIN decoder — curb weight, body class, wheelbase, drive type.

VINs come from FARS/CRSS vehicle tables; decoded attributes are mapped to
IIHS nameplates via the hand-maintained crosswalk.
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import requests

from ..config import RAW, VPIC_BATCH_URL

OUT = RAW / "vpic"
BATCH = 50  # vPIC batch endpoint limit

FIELDS = {"VIN": "vin", "Make": "make", "Model": "model", "ModelYear": "model_year",
          "BodyClass": "body_class", "DriveType": "drive_type",
          "CurbWeightLB": "curb_weight_lb", "WheelBaseShort": "wheelbase_in"}


def decode(vins: list[str], session: requests.Session | None = None) -> pd.DataFrame:
    s = session or requests.Session()
    rows = []
    for i in range(0, len(vins), BATCH):
        chunk = [v for v in vins[i:i + BATCH] if isinstance(v, str) and len(v) >= 11]
        if not chunk:
            continue
        r = s.post(VPIC_BATCH_URL, data={"format": "json", "data": ";".join(chunk)},
                   timeout=120)
        r.raise_for_status()
        for rec in r.json().get("Results", []):
            rows.append({out: rec.get(src) for src, out in FIELDS.items()})
    return pd.DataFrame(rows)


STUDY_MODEL_YEARS = range(2014, 2021)  # MY2017 + MY2020 pooled spans
PREFIX_LEN = 11  # VIN positions 1-11 pin down make/model/trim/engine/year


def study_vehicle_frames():
    """Vehicle rows for crosswalk-matched FARS codes in the study model years."""
    from ..crosswalk import load_crosswalk
    xw = load_crosswalk()
    codes = set(zip(xw["fars_make_code"].astype(int),
                    xw["fars_model_code"].astype(int)))
    for p in (sorted((RAW / "fars").glob("vehicle_*.parquet"))
              + sorted((RAW / "crss").glob("vehicle_*.parquet"))):
        df = pd.read_parquet(p, columns=["VIN", "MAKE", "MODEL", "MOD_YEAR"])
        df = df[df["MOD_YEAR"].isin(STUDY_MODEL_YEARS)]
        df = df[[mm in codes for mm in zip(df["MAKE"], df["MODEL"])]]
        df = df[df["VIN"].astype(str).str.len() >= PREFIX_LEN]
        df["vin_prefix"] = df["VIN"].astype(str).str[:PREFIX_LEN]
        yield df


def run() -> Path:
    """Decode deduped VIN prefixes of study vehicles only. Decoding every full
    VIN in FARS+CRSS (~1.3M) would take days; the 11-char prefix carries the
    spec-level identity curb weight depends on."""
    vins = set()
    for df in study_vehicle_frames():
        vins.update(df["vin_prefix"])
    if not vins:
        raise SystemExit("no VINs found — run ingest-fars / ingest-crss / resolve first")
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "vpic_decoded.parquet"
    done = pd.read_parquet(out)["vin"].tolist() if out.exists() else []
    todo = sorted(vins - set(done))
    print(f"vPIC: {len(todo)} VINs to decode ({len(done)} cached)")
    if todo:
        df = decode(todo)
        if done:
            df = pd.concat([pd.read_parquet(out), df], ignore_index=True)
        df.to_parquet(out, index=False)
    return out
