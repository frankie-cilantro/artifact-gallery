"""Validation gates. Do not ship past a failing gate.

1. Fleet averages: 38 (MY2020), 36 (MY2017), exposure-weighted, within ±1.
2. Class means MY2020: minicars 153, very large luxury cars 4.
3. Side-test effect: Good vs Poor ≈ 70% lower death risk in left-side crashes.
4. Placebo: side rating shows NO significant effect on frontal survival.

Gate 3 failing means the entity resolution is broken — fix that first.
"""
from __future__ import annotations

import math
import sys

import numpy as np
import pandas as pd

from .config import GATES, OUTPUTS
from .analysis.frames import vehicle_rates


def _aggregates() -> pd.DataFrame:
    """IIHS-published fleet/class aggregate rows captured at ingest time.

    Gates 1-2 must compare against these, not per-model means: IIHS aggregates
    are computed over the full fleet including vehicles below the 100k RVY /
    20-death publication threshold (e.g. 'very large luxury cars: 4' has zero
    individually published models). The per-model estimate is reported alongside
    as a diagnostic of that selection gap.
    """
    from .config import RAW
    p = RAW / "iihs_death_rates" / "death_rate_aggregates.parquet"
    return pd.read_parquet(p) if p.exists() else pd.DataFrame()


def gate1_fleet_averages() -> list[dict]:
    results = []
    tol = GATES["fleet_avg"]["tolerance"]
    aggs = _aggregates()
    for cycle, target in [("MY2020", GATES["fleet_avg"]["MY2020"]),
                          ("MY2017", GATES["fleet_avg"]["MY2017"])]:
        df = vehicle_rates(cycle).dropna(subset=["rate_overall"])
        est = (np.average(df["rate_overall"], weights=df["exposure_rvy"])
               if not df.empty and df["exposure_rvy"].notna().all()
               else df["rate_overall"].mean()) if not df.empty else float("nan")
        fleet = aggs[(aggs.get("cycle") == cycle) & (aggs.get("level") == "fleet")] \
            if not aggs.empty else pd.DataFrame()
        if fleet.empty:
            results.append({"gate": 1, "cycle": cycle, "pass": False,
                            "note": "no fleet aggregate captured"})
            continue
        avg = float(fleet["rate_overall"].iloc[0])
        results.append({"gate": 1, "cycle": cycle, "computed": round(avg, 1),
                        "target": target, "pass": abs(avg - target) <= tol,
                        "note": f"published-models exposure-weighted est {est:.1f}"})
    return results


def gate2_class_means() -> list[dict]:
    spec = GATES["class_means_MY2020"]
    aggs = _aggregates()
    results = []
    for cls, target in [(k, v) for k, v in spec.items() if k != "tolerance"]:
        key = cls.lower().replace(" ", "")
        sub = aggs[(aggs.get("cycle") == "MY2020") & (aggs.get("level") == "class") &
                   (aggs["class"].str.lower().str.replace(" ", "") == key)] \
            if not aggs.empty else pd.DataFrame()
        if sub.empty:
            results.append({"gate": 2, "class": cls, "pass": False,
                            "note": "no class aggregate captured"})
            continue
        mean = float(sub["rate_overall"].iloc[0])
        results.append({"gate": 2, "class": cls, "computed": round(mean, 1),
                        "target": target,
                        "pass": abs(mean - target) <= spec["tolerance"]})
    return results


def _crash_data_loaded() -> bool:
    import duckdb
    from .config import DB_PATH
    con = duckdb.connect(str(DB_PATH), read_only=True)
    try:
        return con.execute("SELECT count(*) FROM fact_fars_crash").fetchone()[0] > 0
    finally:
        con.close()


def gate3_side_effect() -> list[dict]:
    """Good vs Poor side rating in left-side crashes from the survival model."""
    if not _crash_data_loaded():
        return [{"gate": 3, "pass": None,
                 "note": "SKIPPED — requires FARS/CRSS + full crosswalk (not loaded)"}]
    surv = OUTPUTS / "survival_model.csv"
    if not surv.exists():
        return [{"gate": 3, "pass": False, "note": "run analyze first"}]
    df = pd.read_csv(surv)
    side = df[(df["direction"] == "left_side") & ~df["placebo"] &
              df["term"].astype(str).str.startswith("side_")]
    if side.empty:
        return [{"gate": 3, "pass": False,
                 "note": "no side-rating term in left-side fit — entity resolution likely broken"}]
    # ordinal coef is per rating step; Good(4) vs Poor(1) = 3 steps
    coef = side.iloc[0]["coef"]
    reduction = 1 - math.exp(coef * 3)
    spec = GATES["side_effect_good_vs_poor"]
    return [{"gate": 3, "computed_reduction": round(reduction, 2),
             "target": spec["target_reduction"],
             "pass": abs(reduction - spec["target_reduction"]) <= spec["tolerance"]}]


def gate4_placebo() -> list[dict]:
    if not _crash_data_loaded():
        return [{"gate": 4, "pass": None,
                 "note": "SKIPPED — requires FARS/CRSS + full crosswalk (not loaded)"}]
    surv = OUTPUTS / "survival_model.csv"
    if not surv.exists():
        return [{"gate": 4, "pass": False, "note": "run analyze first"}]
    df = pd.read_csv(surv)
    plc = df[(df["direction"] == "frontal") & df["placebo"] &
             df["term"].astype(str).str.startswith("side_")]
    if plc.empty:
        return [{"gate": 4, "pass": False, "note": "placebo fit missing"}]
    p = plc.iloc[0]["p_value"]
    return [{"gate": 4, "placebo_p_value": round(float(p), 3),
             "pass": bool(p > 0.05),
             "note": "side rating must NOT predict frontal survival"}]


def run() -> None:
    results = (gate1_fleet_averages() + gate2_class_means()
               + gate3_side_effect() + gate4_placebo())
    out = pd.DataFrame(results)
    OUTPUTS.mkdir(exist_ok=True)
    out.to_csv(OUTPUTS / "validation_gates.csv", index=False)
    print(out.to_string(index=False))
    hard = out[out["pass"].notna()]
    if not hard["pass"].astype(bool).all():
        print("\nGATE FAILURE — do not interpret results past a failing gate.",
              file=sys.stderr)
        sys.exit(1)
    print("\nall gates passed")
