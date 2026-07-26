"""Shared analysis frames pulled from DuckDB."""
import duckdb
import pandas as pd

from ..config import DB_PATH


def con() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DB_PATH), read_only=True)


def vehicle_rates(cycle: str | None = None) -> pd.DataFrame:
    q = """
        SELECT d.*, f.study_cycle, f.rate_overall, f.ci_lo, f.ci_hi,
               f.rate_mv, f.rate_sv, f.rate_sv_roll, f.exposure_rvy
        FROM dim_vehicle d JOIN fact_death_rate f USING (vehicle_key)
    """
    df = con().execute(q).df()
    return df[df.study_cycle == cycle] if cycle else df


def rating_composite() -> pd.DataFrame:
    """Mean ordinal rating across crashworthiness tests, per vehicle."""
    q = """
        SELECT vehicle_key, avg(rating_ord) AS rating_composite,
               count(*) AS n_tests
        FROM fact_rating
        WHERE rating_ord IS NOT NULL
        GROUP BY vehicle_key
    """
    return con().execute(q).df()


def ratings_wide() -> pd.DataFrame:
    r = con().execute(
        "SELECT vehicle_key, test_name, rating_ord FROM fact_rating "
        "WHERE rating_ord IS NOT NULL").df()
    if r.empty:
        return pd.DataFrame({"vehicle_key": pd.Series(dtype=int)})
    return r.pivot_table(index="vehicle_key", columns="test_name",
                         values="rating_ord", aggfunc="max").reset_index()
