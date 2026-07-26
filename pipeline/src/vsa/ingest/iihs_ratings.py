"""IIHS per-vehicle crashworthiness ratings.

Verified path (2026-07): vehicle detail pages are server-rendered — the
summary ratings table is plain HTML, no API needed. Vehicle URLs come from
POST /api/ratings/search-rated-vehicle-lookup {"search": "<name>"}, whose
UrlSuffix is make/model-variant-slug/year; we swap in the model year we want
(the death-rate span's final year).

Ratings are encoded ordinal (Good=4 ... Poor=1) with the raw string kept.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import pandas as pd
import requests

from ..config import RATING_ORD, RAW
from .common import snapshot

OUT = RAW / "iihs_ratings"
LOOKUP = "https://www.iihs.org/api/ratings/search-rated-vehicle-lookup"
PAGE = "https://www.iihs.org/ratings/vehicle/{slug}/{year}"

_ROW = re.compile(
    r'<th scope="row"><a href="#[^"]+">([^<]+)</a></th>'
    r'<td><div class="rating-icon-block"><abbr aria-label="([^"]+)"')

_TEST_NAMES = {
    "small overlap front: driver-side": "small_overlap_driver",
    "small overlap front: passenger-side": "small_overlap_passenger",
    "moderate overlap front: original test": "moderate_overlap_front",
    "moderate overlap front: updated test": "moderate_overlap_front_updated",
    "side: original test": "side_original",
    "side: updated test": "side_updated",
    "roof strength": "roof_strength",
    "head restraints & seats": "head_restraints",
}

# body-style tokens in death-rate nameplates -> preferred variant substring
_VARIANT_HINTS = [("hatchback", "hatchback"), ("sedan", "4-door sedan"),
                  ("coupe", "2-door"), ("wagon", "wagon"),
                  ("crew cab", "crew cab"), ("extended cab", "extended cab"),
                  ("convertible", "convertible")]


def _pick_variant(candidates: list[dict], nameplate: str) -> dict | None:
    if not candidates:
        return None
    low = nameplate.lower()
    for token, want in _VARIANT_HINTS:
        if token in low:
            hits = [c for c in candidates if want in c["VariantType"].lower()]
            if hits:
                return hits[0]
    # default preference: 4-door sedan, else SUV/first
    for c in candidates:
        if "4-door" in c["VariantType"].lower():
            return c
    return candidates[0]


_TRIM_WORDS = (r"short bed|long bed|crew cab|extended cab|double cab|quad cab|"
               r"king cab|mega cab|crew max|supercab|supercrew|2dr|4dr|hybrid|"
               r"plug-in|HEMI|GT|G4|convertible|coupe|sedan|hatchback|"
               r"Prime|classic|1500|2500|3500")


def _strip_trim(nameplate: str, aggressive: bool = False) -> str:
    """Drop bed/cab noise; aggressive mode also drops trim/body tokens that
    defeat the lookup search ('Honda Accord hybrid' -> 'Honda Accord')."""
    pat = _TRIM_WORDS if aggressive else r"short bed|long bed|crew cab|extended cab|2dr|4dr"
    s = re.sub(rf"\b({pat})\b", "", nameplate, flags=re.I)
    return re.sub(r"\s+", " ", s).strip()


def fetch_vehicle_ratings(session: requests.Session, nameplate: str,
                          year: int) -> list[dict] | None:
    candidates = []
    for aggressive in (False, True):
        for attempt in range(4):
            r = session.post(LOOKUP,
                             json={"search": _strip_trim(nameplate, aggressive)},
                             timeout=30)
            if r.status_code == 429:  # rate-limited; back off and retry
                time.sleep(5 * (attempt + 1))
                continue
            r.raise_for_status()
            candidates = r.json() or []
            break
        if candidates:
            break
    if not candidates:
        return None
    picked = _pick_variant(candidates, nameplate)
    ordered = [picked] + [c for c in candidates if c is not picked]
    page = None
    # the exact model year may not have its own page (design generations);
    # walk back a couple of years, then take the lookup's own year, across
    # up to three body variants
    for cand in ordered[:3]:
        slug = "/".join(cand["UrlSuffix"].split("/")[:-1])
        for y in (year, year - 1, year - 2, cand["ModelYear"]):
            page = session.get(PAGE.format(slug=slug, year=y), timeout=60)
            if page.status_code == 200 and _ROW.search(page.text):
                year = y
                break
        else:
            continue
        break
    else:
        return None
    rows = []
    for disp, raw in _ROW.findall(page.text):
        test = _TEST_NAMES.get(disp.replace("&amp;", "&").strip().lower())
        if test is None:
            continue
        rows.append({"nameplate": nameplate, "rating_year": year,
                     "test_name": test, "rating_raw": raw,
                     "rating_ord": RATING_ORD.get(raw),
                     "measurement_value": None, "variant": cand["VariantType"]})
    return rows or None


def run(cycles: tuple[str, ...] = ("MY2020", "MY2017")) -> Path:
    dr_path = RAW / "iihs_death_rates" / "death_rates.parquet"
    if not dr_path.exists():
        raise SystemExit("run ingest-iihs-death-rates first (need the nameplate list)")
    dr = pd.read_parquet(dr_path)
    dr = dr[dr.cycle.isin(cycles)]
    targets = dr[["nameplate", "model_years"]].drop_duplicates()

    session = requests.Session()
    rows, misses = [], []
    prior = OUT / "ratings.parquet"
    if prior.exists():
        cached = pd.read_parquet(prior)
        rows = cached.to_dict("records")
        targets = targets[~targets.nameplate.isin(set(cached.nameplate))]
        print(f"incremental: {len(targets)} nameplates left to fetch")
    for _, v in targets.iterrows():
        span = str(v["model_years"])
        end = span.split("-")[-1]
        year = int(end) if len(end) == 4 else int(span[:2] + end)
        try:
            got = fetch_vehicle_ratings(session, v["nameplate"], year)
        except requests.RequestException as e:
            got = None
            misses.append((v["nameplate"], year, str(e)))
        if got:
            rows += got
        else:
            misses.append((v["nameplate"], year, "no ratings found"))
        time.sleep(0.5)

    if not rows:
        raise SystemExit("no ratings retrieved — page structure likely changed; "
                         "update _ROW regex in iihs_ratings.py")
    df = pd.DataFrame(rows).drop_duplicates(
        subset=["nameplate", "rating_year", "test_name"])
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / "ratings.parquet"
    df.to_parquet(out, index=False)
    pd.DataFrame(misses, columns=["nameplate", "year", "reason"]) \
        .to_csv(OUT / "ratings_misses.csv", index=False)
    snapshot("iihs_ratings", df.to_csv(index=False).encode(),
             {"ext": ".csv", "rows": len(df),
              "note": f"cycles={cycles}, misses={len(misses)}"})
    print(f"ratings: {len(df)} test rows for "
          f"{df.nameplate.nunique()}/{len(targets)} nameplates "
          f"({len(misses)} misses) -> {out}")
    return out
