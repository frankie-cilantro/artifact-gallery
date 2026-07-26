"""4.5 Conditional survival model — the core deliverable.

logit P(driver_death | crash_involvement) ~ rating_by_test + curb_weight
    + class + driver_age + driver_sex + n_vehicles + impact_point
    + road_class + speed_limit

Fatal outcomes come from FARS; involvements from CRSS (survey-weighted).
Fit separately by impact direction, matching each crash type to its test:
frontal -> moderate/small overlap; left-side -> side; rollover -> roof strength.
Cross-direction fits are placebo checks — a side rating predicting frontal
survival means residual confounding, not physics.
"""
from __future__ import annotations

import pandas as pd
import statsmodels.api as sm
import statsmodels.formula.api as smf

from ..config import DIRECTION_TESTS, OUTPUTS
from .ceiling import non_discriminating_tests
from .frames import con, ratings_wide

CONTROLS = "curb_weight + C(cls) + driver_age + C(driver_sex) + n_vehicles + C(road_class) + speed_limit"


def _stacked(direction: str) -> pd.DataFrame:
    """Stack FARS (fatal, weight=1) and CRSS (mostly non-fatal, survey weights)."""
    c = con()
    fars = c.execute("""
        SELECT f.vehicle_key, f.driver_age, f.driver_sex, f.n_vehicles,
               f.road_class, f.speed_limit, f.impact_point, f.fatal_driver,
               1.0 AS w, d.class AS cls, d.curb_weight
        FROM fact_fars_crash f JOIN dim_vehicle d USING (vehicle_key)
        WHERE f.fatal_driver""").df()
    crss = c.execute("""
        SELECT f.vehicle_key, f.driver_age, f.driver_sex, f.n_vehicles,
               f.road_class, f.speed_limit, f.impact_point, f.fatal_driver,
               f.survey_weight AS w, d.class AS cls, d.curb_weight
        FROM fact_crss_involve f JOIN dim_vehicle d USING (vehicle_key)""").df()
    df = pd.concat([fars, crss], ignore_index=True)
    from ..storage import impact_direction
    df["direction"] = [impact_direction(i, 0) for i in df["impact_point"]]
    return df[df["direction"] == direction]


def fit_direction(direction: str, tests: list[str],
                  excluded: set[str]) -> list[dict]:
    rw = ratings_wide()
    usable = [t for t in tests if t in rw.columns and t not in excluded]
    if not usable:
        return [{"direction": direction, "term": None,
                 "note": "no usable (discriminating) tests"}]
    df = _stacked(direction).merge(rw[["vehicle_key"] + usable], on="vehicle_key")
    df = df.dropna(subset=usable + ["curb_weight", "driver_age", "speed_limit"])
    if df["fatal_driver"].nunique() < 2 or len(df) < 200:
        return [{"direction": direction, "term": None,
                 "note": f"insufficient data (n={len(df)})"}]
    formula = f"fatal_driver ~ {' + '.join(usable)} + {CONTROLS}"
    fit = smf.glm(formula, data=df, family=sm.families.Binomial(),
                  freq_weights=df["w"]).fit(cov_type="HC1")
    ci = fit.conf_int()
    return [{"direction": direction, "term": term, "coef": fit.params[term],
             "ci_lo": ci.loc[term, 0], "ci_hi": ci.loc[term, 1],
             "p_value": fit.pvalues[term], "n": int(fit.nobs)}
            for term in fit.params.index]


def run() -> pd.DataFrame:
    excluded = non_discriminating_tests()
    rows = []
    for direction, tests in DIRECTION_TESTS.items():
        rows += fit_direction(direction, tests, excluded)
    # Placebo: side ratings on frontal survival; frontal ratings on left-side.
    rows += [{**r, "placebo": True} for r in
             fit_direction("frontal", DIRECTION_TESTS["left_side"], excluded)]
    rows += [{**r, "placebo": True} for r in
             fit_direction("left_side", DIRECTION_TESTS["frontal"], excluded)]
    out = pd.DataFrame(rows)
    out["placebo"] = out.get("placebo", False)
    if isinstance(out["placebo"], pd.Series):
        out["placebo"] = out["placebo"].fillna(False)
    out.to_csv(OUTPUTS / "survival_model.csv", index=False)
    return out
