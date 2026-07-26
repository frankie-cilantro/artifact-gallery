"""4.4 Variance decomposition via sequential OLS blocks:
log(rate) ~ class + luxury_flag + curb_weight + rating_composite
Report incremental R^2 per block. Hypothesis: class + weight >> luxury >> ratings."""
import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

from ..config import OUTPUTS
from .frames import rating_composite, vehicle_rates

BLOCKS = [
    ("class", "C(cls)"),
    ("curb_weight", "C(cls) + curb_weight"),
    ("luxury", "C(cls) + curb_weight + luxury_flag"),
    ("ratings", "C(cls) + curb_weight + luxury_flag + rating_composite"),
]


def run() -> pd.DataFrame:
    df = vehicle_rates().merge(rating_composite(), on="vehicle_key")
    df = df.rename(columns={"class": "cls"})
    df["log_rate"] = np.log(df["rate_overall"].clip(lower=0.5))  # zeros exist; CI-aware handling in report
    df = df.dropna(subset=["log_rate", "cls", "curb_weight", "luxury_flag",
                           "rating_composite"])
    if len(df) < 30:
        print(f"variance decomposition skipped — n={len(df)} "
              "(needs ratings + curb weights loaded)")
        return pd.DataFrame()
    rows, prev_r2 = [], 0.0
    for name, rhs in BLOCKS:
        fit = smf.ols(f"log_rate ~ {rhs}", data=df).fit()
        rows.append({"block": name, "r2": fit.rsquared,
                     "incremental_r2": fit.rsquared - prev_r2, "n": int(fit.nobs)})
        prev_r2 = fit.rsquared
    out = pd.DataFrame(rows)
    out.to_csv(OUTPUTS / "variance_decomposition.csv", index=False)
    return out
