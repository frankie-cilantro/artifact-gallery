"""Phase 5 outputs: effect_estimates.csv, model_scorecard.csv, and the HTML
report with the variance decomposition and placebo checks front and center."""
from __future__ import annotations

import pandas as pd
from jinja2 import Template

from .config import OUTPUTS
from .analysis.frames import rating_composite, vehicle_rates

TEMPLATE = Template("""<!doctype html><html><head><meta charset="utf-8">
<title>Vehicle Safety Analytics — Report</title>
<style>
 body{font-family:system-ui;max-width:960px;margin:2rem auto;padding:0 1rem;color:#222}
 table{border-collapse:collapse;margin:1rem 0}
 td,th{border:1px solid #ccc;padding:4px 10px;font-size:14px;text-align:right}
 th{background:#f2f2f2} td:first-child,th:first-child{text-align:left}
 .fail{background:#fdd}.pass{background:#dfd}
 .caveat{background:#fff8e0;padding:1rem;border-left:4px solid #d90}
</style></head><body>
<h1>How much do IIHS ratings predict real-world driver fatality risk?</h1>

<h2>Data status — what this report can and cannot say yet</h2>
{{ status | safe }}

<h2>Variance decomposition</h2>
<p>Incremental R² of each block in <code>log(rate) ~ class + curb_weight +
luxury + rating_composite</code>. This is the headline: how much the ratings
add once class and mass are in the model.</p>
{{ vd | safe }}

<h2>Placebo checks</h2>
<p>A side rating should not predict frontal survival. If it does, the
"effect" is residual confounding, not crashworthiness.</p>
{{ placebo | safe }}

<h2>Validation gates</h2>
{{ gates | safe }}

<h2>Conditional survival model (core deliverable)</h2>
{{ survival | safe }}

<h2>Ceiling diagnostic</h2>
{{ ceiling | safe }}

<h2 class="caveat">Known limitations</h2>
<ul>
<li>CRSS involvement counts are survey-weighted estimates from a complex sample.</li>
<li>Death rates adjust for driver age/sex only — not income, annual mileage,
road-type mix, or driving style, all large and unmeasured.</li>
<li>IIHS pools up to three prior model years; "MY2020" is a design generation.</li>
<li>Low-volume makes below the 100k RVY / 20-death threshold are structurally
absent. Absence is not safety.</li>
<li>Selection into vehicle class is not random and cannot be fully adjusted
away. Nothing here is causal.</li>
</ul>
</body></html>""")


def _data_status() -> str:
    """Plain-language inventory of what's loaded and what each gap means."""
    from .analysis.frames import con
    c = con()
    counts = {t: c.execute(f"SELECT count(*) FROM {t}").fetchone()[0]
              for t in ["fact_death_rate", "fact_rating", "fact_fars_crash",
                        "fact_crss_involve"]}
    items = []
    items.append(
        f"<li><b>IIHS death rates: loaded</b> ({counts['fact_death_rate']} "
        "model-cycle rows). Everything about death-rate levels, class effects, "
        "and cross-cycle persistence is real and validated against IIHS's own "
        "published totals.</li>")
    if counts["fact_rating"]:
        items.append(
            f"<li><b>IIHS crashworthiness ratings: loaded</b> "
            f"({counts['fact_rating']} test results). The rating-vs-death-rate "
            "correlations below are real, but they are <i>aggregate-level</i>: "
            "they mix how often people crash with how well the car protects "
            "them when they do.</li>")
    else:
        items.append(
            "<li><b>IIHS crashworthiness ratings: NOT loaded.</b> Every "
            "analysis involving ratings (naive correlation, within-class "
            "correlation, variance decomposition) is skipped. Nothing in this "
            "report says anything about whether ratings predict deaths.</li>")
    if counts["fact_fars_crash"] and counts["fact_crss_involve"]:
        items.append("<li><b>FARS + CRSS crash data: loaded.</b> The "
                     "conditional survival model separates crashing from "
                     "surviving a crash.</li>")
    else:
        items.append(
            "<li><b>FARS + CRSS crash-level data: NOT loaded.</b> This is the "
            "big one. Without it we cannot separate <i>who crashes</i> from "
            "<i>who survives a crash</i>. Any rating-vs-death-rate pattern "
            "shown here could just mean careful drivers buy highly-rated cars. "
            "The survival model and the placebo checks (validation gates 3-4) "
            "wait on this data plus the full FARS crosswalk.</li>")
    items.append(
        "<li><b>Curb weights (vPIC): NOT loaded</b> unless noted in the "
        "variance table. Class absorbs some of the vehicle-mass effect, but "
        "weight differences <i>within</i> a class are invisible, so the "
        "ratings block may soak up credit that belongs to mass.</li>"
        if counts["fact_fars_crash"] == 0 else "")
    return "<ul>" + "".join(i for i in items if i) + "</ul>"


def _table(path, empty_msg: str) -> str:
    p = OUTPUTS / path
    if not p.exists():
        return f"<p><em>{empty_msg}</em></p>"
    return pd.read_csv(p).to_html(index=False, na_rep="")


def run() -> None:
    OUTPUTS.mkdir(exist_ok=True)

    # effect_estimates.csv — every model coefficient with CI
    surv = OUTPUTS / "survival_model.csv"
    if surv.exists():
        pd.read_csv(surv).to_csv(OUTPUTS / "effect_estimates.csv", index=False)

    # model_scorecard.csv — per-vehicle death rate, CI, ratings, class-adjusted z
    df = vehicle_rates().merge(rating_composite(), on="vehicle_key", how="left")
    grp = df.groupby(["study_cycle", "class"])["rate_overall"]
    df["class_z"] = (df["rate_overall"] - grp.transform("mean")) / grp.transform("std")
    df[["nameplate", "drivetrain", "class", "study_cycle", "rate_overall",
        "ci_lo", "ci_hi", "rating_composite", "class_z"]] \
        .to_csv(OUTPUTS / "model_scorecard.csv", index=False)

    placebo = "<p><em>survival model not yet run</em></p>"
    if surv.exists():
        sdf = pd.read_csv(surv)
        placebo = sdf[sdf["placebo"] == True].to_html(index=False, na_rep="")  # noqa: E712

    html = TEMPLATE.render(
        status=_data_status(),
        vd=_table("variance_decomposition.csv", "variance decomposition not yet run"),
        placebo=placebo,
        gates=_table("validation_gates.csv", "gates not yet run"),
        survival=_table("survival_model.csv", "survival model not yet run"),
        ceiling=_table("ceiling_diagnostic.csv", "ceiling diagnostic not yet run"),
    )
    (OUTPUTS / "report.html").write_text(html)
    print(f"report -> {OUTPUTS / 'report.html'}")
