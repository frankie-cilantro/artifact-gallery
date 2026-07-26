"""4.3 Within-class partial correlation: Spearman rho stratified by
class x drivetrain — the honest version of 4.2."""
import pandas as pd
from scipy.stats import spearmanr

from ..config import OUTPUTS
from .frames import rating_composite, vehicle_rates

MIN_N = 5  # strata smaller than this produce noise, not estimates


def run() -> pd.DataFrame:
    df = vehicle_rates().merge(rating_composite(), on="vehicle_key")
    df = df.dropna(subset=["rate_overall", "rating_composite"])
    rows = []
    for (cls, dt), g in df.groupby(["class", "drivetrain"]):
        if len(g) < MIN_N:
            continue
        rho, p = spearmanr(g["rating_composite"], g["rate_overall"])
        rows.append({"class": cls, "drivetrain": dt, "n": len(g),
                     "spearman_rho": rho, "p_value": p})
    out = pd.DataFrame(rows).sort_values("n", ascending=False)
    out.to_csv(OUTPUTS / "within_class_correlation.csv", index=False)
    return out
