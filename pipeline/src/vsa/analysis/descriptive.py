"""4.1 Descriptive: death-rate distribution by class. Confirms the class effect
and sets the baseline the ratings must beat."""
import pandas as pd

from ..config import OUTPUTS
from .frames import vehicle_rates


def run() -> pd.DataFrame:
    df = vehicle_rates()
    by_class = (df.groupby(["study_cycle", "class"])
                .agg(n=("rate_overall", "size"),
                     mean=("rate_overall", "mean"),
                     median=("rate_overall", "median"),
                     p10=("rate_overall", lambda s: s.quantile(0.1)),
                     p90=("rate_overall", lambda s: s.quantile(0.9)))
                .reset_index())
    OUTPUTS.mkdir(exist_ok=True)
    by_class.to_csv(OUTPUTS / "descriptive_by_class.csv", index=False)
    return by_class
