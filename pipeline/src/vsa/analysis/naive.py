"""4.2 Naive pooled Spearman rho between composite rating and death rate.

Expected weak. Reported anyway — then explained as the wrong number, because it
conflates crash involvement with crash survival and ignores class/mass/driver
mix entirely."""
from scipy.stats import spearmanr

from .frames import rating_composite, vehicle_rates


def run() -> dict:
    df = vehicle_rates().merge(rating_composite(), on="vehicle_key")
    df = df.dropna(subset=["rate_overall", "rating_composite"])
    if len(df) < 3:
        return {"analysis": "naive_pooled_spearman", "n": len(df),
                "note": "skipped — no ratings ingested"}
    rho, p = spearmanr(df["rating_composite"], df["rate_overall"])
    return {"analysis": "naive_pooled_spearman", "n": len(df),
            "spearman_rho": rho, "p_value": p,
            "caveat": "pooled across class; conflates involvement and survival"}
