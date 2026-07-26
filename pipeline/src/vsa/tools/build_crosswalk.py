"""Semi-automated crosswalk construction (planned as hand-work; automated).

FARS vehicle rows carry VINs. For every FARS (MAKE, MODEL) code pair seen in
the study model years, decode a sample of VINs via vPIC to get canonical
make/model strings, then fuzzy-match those strings against the IIHS
MY2017/MY2020 nameplates. Every (nameplate, drivetrain) death-rate key gets a
crosswalk row; low-confidence matches land in a review file instead of being
silently accepted — a reviewer promotes them by editing crosswalk.csv.
"""
from __future__ import annotations

import re
from collections import Counter

import pandas as pd
from rapidfuzz import fuzz

from ..config import CROSSWALK_CSV, DATA, RAW
from ..crosswalk import norm_drivetrain
from ..ingest import vpic

STUDY_MODEL_YEARS = range(2014, 2021)  # MY2017 + MY2020 pooled spans
SAMPLE_VINS_PER_CODE = 6
HIGH_CONFIDENCE = 87  # rapidfuzz score; below this -> review file
REVIEW_CSV = DATA / "crosswalk" / "crosswalk_review.csv"

# body/variant tokens that IIHS appends to nameplates but vPIC models omit
_VARIANT_TOKENS = {
    "sedan", "coupe", "convertible", "hatchback", "wagon", "4-door", "2-door",
    "4dr", "2dr", "crew", "extended", "double", "cab", "regular", "short",
    "long", "bed", "1/2", "3/4", "ton", "plug-in", "hybrid", "classic",
}


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]", " ", str(s).lower()).strip()


def _core_name(nameplate: str) -> str:
    """Strip IIHS body-variant suffix tokens: 'Chevrolet Camaro coupe' -> 'chevrolet camaro'."""
    toks = [t for t in _norm(nameplate).split() if t not in _VARIANT_TOKENS]
    return " ".join(toks)


def _body_hint(nameplate: str) -> str:
    toks = [t for t in _norm(nameplate).split() if t in _VARIANT_TOKENS]
    return " ".join(toks)


def sample_vins() -> pd.DataFrame:
    """One row per FARS (MAKE, MODEL): sampled VINs from the study model years."""
    frames = []
    for p in sorted((RAW / "fars").glob("vehicle_*.parquet")):
        df = pd.read_parquet(p, columns=["VIN", "MAKE", "MODEL", "MOD_YEAR"])
        df = df[df["MOD_YEAR"].isin(STUDY_MODEL_YEARS)]
        df = df[df["VIN"].astype(str).str.len() >= 11]
        frames.append(df)
    allv = pd.concat(frames, ignore_index=True)
    return (allv.groupby(["MAKE", "MODEL"])
                .agg(vins=("VIN", lambda s: list(pd.Series(s).drop_duplicates()
                                                 .head(SAMPLE_VINS_PER_CODE))),
                     n_rows=("VIN", "size"))
                .reset_index())


def decode_codes(codes: pd.DataFrame) -> pd.DataFrame:
    """vPIC-decode sampled VINs; majority-vote make/model/body per code pair."""
    out_path = RAW / "vpic" / "code_labels.parquet"
    if out_path.exists():
        return pd.read_parquet(out_path)
    vins = [v for lst in codes["vins"] for v in lst]
    print(f"decoding {len(vins)} sampled VINs across {len(codes)} FARS code pairs")
    dec = vpic.decode(vins).set_index("vin")
    rows = []
    for _, r in codes.iterrows():
        hits = dec.loc[dec.index.intersection([str(v) for v in r["vins"]])]
        hits = hits[hits["make"].notna() & (hits["make"].astype(str) != "")]
        if hits.empty:
            continue
        make = Counter(hits["make"].str.title()).most_common(1)[0][0]
        model = Counter(hits["model"].astype(str)).most_common(1)[0][0]
        body = Counter(hits["body_class"].astype(str)).most_common(1)[0][0]
        rows.append({"fars_make_code": int(r["MAKE"]), "fars_model_code": int(r["MODEL"]),
                     "make": make, "model": model, "body_class": body,
                     "n_rows": int(r["n_rows"])})
    labels = pd.DataFrame(rows)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    labels.to_parquet(out_path, index=False)
    return labels


def match(labels: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    dr = pd.read_csv(DATA / "processed" / "death_rates.csv")
    need = dr[dr["cycle"].isin(["MY2017", "MY2020"])].copy()
    need["drivetrain"] = need["drivetrain"].map(norm_drivetrain)
    keys = (need[["nameplate", "drivetrain", "class"]]
            .drop_duplicates(["nameplate", "drivetrain"]).reset_index(drop=True))

    labels = labels.copy()
    labels["cand"] = (labels["make"].map(_norm) + " " + labels["model"].map(_norm)).str.strip()

    out, review = [], []
    for _, k in keys.iterrows():
        core = _core_name(k["nameplate"])
        scored = labels.assign(score=labels["cand"].map(
            lambda c: fuzz.token_set_ratio(core, c)))
        # prefer exact make prefix, then score, then crash volume (ties)
        make_tok = core.split()[0]
        scored["make_ok"] = scored["cand"].str.startswith(make_tok)
        best = scored.sort_values(["make_ok", "score", "n_rows"],
                                  ascending=False).iloc[0]
        row = {"iihs_name": k["nameplate"],
               "fars_make_code": int(best["fars_make_code"]),
               "fars_model_code": int(best["fars_model_code"]),
               "vpic_body_class": best["body_class"],
               "drivetrain": k["drivetrain"],
               "class": k["class"],
               "luxury_flag": int("luxury" in str(k["class"]).lower()),
               "match_score": int(best["score"]),
               "matched_string": best["cand"]}
        out.append(row)
        if best["score"] < HIGH_CONFIDENCE or not best["make_ok"]:
            review.append(row)
    return pd.DataFrame(out), pd.DataFrame(review)


HD_PICKUP_PAT = r"(?i)\b(?:f-?)?(?:2500|3500|250|350)\b"


def _fix_hd_pickups(xw: pd.DataFrame) -> pd.DataFrame:
    """FARS codes heavy-duty pickups (F-250/350, 2500/3500) under the 880
    medium/heavy series, not the light-pickup code — fuzzy matching lands them
    on vans or the 1500-series instead. Force model code 880 for that band.
    880 pools the 2500/3500 GVWR classes; noted as a limitation."""
    hd = (xw["iihs_name"].str.contains(HD_PICKUP_PAT, regex=True)
          & xw["class"].str.contains("pickup", case=False, na=False))
    xw.loc[hd, "fars_model_code"] = 880
    xw.loc[hd, "vpic_body_class"] = "Pickup"
    xw.loc[hd, "matched_string"] = "HD-pickup rule (FARS 880 series)"
    xw.loc[hd, "match_score"] = 100
    if hd.any():
        print(f"HD-pickup rule applied to {int(hd.sum())} rows")
    return xw


def run() -> None:
    codes = sample_vins()
    labels = decode_codes(codes)
    xw, review = match(labels)
    xw = _fix_hd_pickups(xw)
    review = review[~review["iihs_name"].isin(
        xw.loc[xw["matched_string"].str.startswith("HD-pickup"), "iihs_name"])]
    hdr = (
        "# Entity-resolution crosswalk: IIHS nameplate <-> FARS make/model codes.\n"
        "# Built semi-automatically by src/vsa/tools/build_crosswalk.py:\n"
        "# FARS VIN samples -> vPIC decode -> fuzzy match to IIHS nameplates.\n"
        "# Low-confidence rows are duplicated into crosswalk_review.csv — review\n"
        "# and correct HERE (this file is what resolve() reads). Every MY2017/\n"
        "# MY2020 death-rate row must resolve or `make resolve` fails loudly.\n"
    )
    cols = ["iihs_name", "fars_make_code", "fars_model_code", "vpic_body_class",
            "drivetrain", "class", "luxury_flag"]
    CROSSWALK_CSV.parent.mkdir(parents=True, exist_ok=True)
    with CROSSWALK_CSV.open("w") as f:
        f.write(hdr)
        xw[cols].to_csv(f, index=False)
    review.to_csv(REVIEW_CSV, index=False)
    print(f"wrote {len(xw)} crosswalk rows; {len(review)} low-confidence -> {REVIEW_CSV}")


if __name__ == "__main__":
    run()
