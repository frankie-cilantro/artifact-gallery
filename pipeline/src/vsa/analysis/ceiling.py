"""4.6 Ceiling-effect diagnostic: where >90% of the fleet scores Good in a
model year, the test no longer discriminates and is excluded from the survival
model. This is the mechanism behind the weak small-overlap effect — shown, not
assumed."""
import pandas as pd

from ..config import CEILING_SHARE, OUTPUTS
from .frames import con


def rating_distribution() -> pd.DataFrame:
    return con().execute("""
        SELECT test_name, rating_year,
               count(*) AS n,
               avg(CASE WHEN rating_ord = 4 THEN 1.0 ELSE 0 END) AS share_good
        FROM fact_rating
        WHERE rating_ord IS NOT NULL
        GROUP BY test_name, rating_year
        ORDER BY test_name, rating_year""").df()


def run() -> pd.DataFrame:
    dist = rating_distribution()
    dist["ceiling_flag"] = dist["share_good"] > CEILING_SHARE
    dist.to_csv(OUTPUTS / "ceiling_diagnostic.csv", index=False)
    return dist


def non_discriminating_tests() -> set[str]:
    """Tests at ceiling fleet-wide (weighted across years)."""
    dist = rating_distribution()
    if dist.empty:
        return set()
    agg = dist.groupby("test_name").apply(
        lambda g: (g.share_good * g.n).sum() / g.n.sum(), include_groups=False)
    return set(agg[agg > CEILING_SHARE].index)
