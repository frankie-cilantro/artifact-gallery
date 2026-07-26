"""4.4 Variance decomposition via sequential OLS blocks:
log(rate) ~ class + [curb_weight] + luxury_flag + rating_composite
Report incremental R^2 per block. Hypothesis: class + weight >> luxury >> ratings.

curb_weight enters only when the vPIC join has populated it — otherwise the
block is skipped and flagged, since class alone absorbs much (not all) of the
mass effect.
"""
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from ..config import OUTPUTS
from .frames import rating_composite, vehicle_rates


def run() -> pd.DataFrame:
    df = vehicle_rates().merge(rating_composite(), on="vehicle_key")
    df = df.rename(columns={"class": "cls"})
    df["log_rate"] = np.log(df["rate_overall"].clip(lower=0.5))  # zeros exist; CI-aware handling in report
    have_weight = df["curb_weight"].notna().sum() > 30

    blocks = [("class", ["C(cls)"])]
    if have_weight:
        blocks.append(("curb_weight", ["curb_weight"]))
    blocks += [("luxury", ["luxury_flag"]), ("ratings", ["rating_composite"])]

    need = ["log_rate", "cls", "luxury_flag", "rating_composite"] + \
        (["curb_weight"] if have_weight else [])
    df = df.dropna(subset=need)
    if len(df) < 30:
        print(f"variance decomposition skipped — n={len(df)} usable rows")
        return pd.DataFrame()

    rows, rhs, prev_r2 = [], [], 0.0
    for name, terms in blocks:
        rhs += terms
        fit = smf.ols(f"log_rate ~ {' + '.join(rhs)}", data=df).fit()
        rows.append({"block": name, "r2": fit.rsquared,
                     "incremental_r2": fit.rsquared - prev_r2, "n": int(fit.nobs)})
        prev_r2 = fit.rsquared
    out = pd.DataFrame(rows)
    if not have_weight:
        out["note"] = "curb_weight block absent — vPIC weights not loaded"
    out.to_csv(OUTPUTS / "variance_decomposition.csv", index=False)
    return out
