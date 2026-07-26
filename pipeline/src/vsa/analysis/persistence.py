"""4.7 Cross-cycle persistence: nameplate-level rank correlation across
2011/2014/2017/2020 study cycles. Kendall's tau on nameplates present in >= 3
cycles distinguishes durable design/buyer effects from small-sample noise."""
import itertools

import pandas as pd
from scipy.stats import kendalltau

from ..config import OUTPUTS
from .frames import vehicle_rates

MIN_CYCLES = 3


def run() -> pd.DataFrame:
    df = vehicle_rates()
    wide = df.pivot_table(index="nameplate", columns="study_cycle",
                          values="rate_overall", aggfunc="mean")
    stable = wide[wide.notna().sum(axis=1) >= MIN_CYCLES]
    rows = []
    for a, b in itertools.combinations(sorted(wide.columns), 2):
        pair = stable[[a, b]].dropna()
        if len(pair) < 10:
            continue
        tau, p = kendalltau(pair[a], pair[b])
        rows.append({"cycle_a": a, "cycle_b": b, "n_nameplates": len(pair),
                     "kendall_tau": tau, "p_value": p})
    out = pd.DataFrame(rows)
    out.to_csv(OUTPUTS / "persistence.csv", index=False)
    stable.reset_index().to_csv(OUTPUTS / "persistence_nameplates.csv", index=False)
    return out
