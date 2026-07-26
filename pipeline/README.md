# Vehicle Safety Analytics Pipeline

Quantifies how much IIHS crashworthiness ratings predict real-world driver
fatality risk once vehicle class, mass, and driver mix are controlled for.
Local-first: everything lands in a single DuckDB file. No cloud dependency.

The core design point: **published death rates conflate crash involvement with
crash survival.** The primary deliverable is the conditional survival model
(`P(driver_death | crash_involvement)`), which separates crashworthiness from
crash propensity. Everything else is scaffolding around that.

## Layout

```
pipeline/
  Makefile                 # end-to-end targets: ingest, resolve, load, analyze, validate, report
  requirements.txt
  src/vsa/
    config.py              # paths, constants, study cycles
    ingest/
      iihs_death_rates.py  # JSON endpoint capture + Status Report PDF fallback (pdfplumber)
      iihs_ratings.py      # per-vehicle crashworthiness ratings
      fars.py              # NHTSA FARS annual zips (ACCIDENT/VEHICLE/PERSON), 2015+
      crss.py              # CRSS involvements (survey-weighted denominator)
      vpic.py              # NHTSA vPIC VIN decoder (curb weight, body class, drive type)
    crosswalk.py           # entity resolution: IIHS nameplate <-> FARS codes <-> vPIC. Fails loudly.
    storage.py             # DuckDB schema + loaders (star-ish, see schema.sql)
    schema.sql
    analysis/
      descriptive.py       # 4.1 death rate distribution by class
      naive.py             # 4.2 pooled Spearman rho (the wrong number, reported anyway)
      within_class.py      # 4.3 class x drivetrain stratified partial correlation
      variance_decomp.py   # 4.4 incremental R^2: class + weight >> luxury >> ratings
      survival.py          # 4.5 conditional logit by impact direction + placebo checks
      ceiling.py           # 4.6 non-discriminating test flags (>90% Good)
      persistence.py       # 4.7 Kendall tau across 2011/2014/2017/2020 cycles
      mileage.py           # 4.8 per-10B-VMT recomputation where VMT available
    validate.py            # validation gates — pipeline refuses to ship past a failing gate
    report.py              # HTML report; variance decomposition + placebos front and center
    cli.py                 # python -m vsa <stage>
  data/
    crosswalk/crosswalk.csv  # hand-maintained; versioned in git
    raw/                     # snapshots of every pull (gitignored except manifests)
  outputs/                   # effect_estimates.csv, model_scorecard.csv, persistence.csv, report.html
  tests/                     # crosswalk assertions, gate unit tests
```

## Quick start

```bash
cd pipeline
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt

make ingest      # pulls IIHS + FARS + CRSS + vPIC; snapshots raw responses under data/raw/
make resolve     # builds/validates the crosswalk; FAILS if any IIHS row is unresolved
make load        # creates vsa.duckdb with the star schema
make analyze     # runs 4.1 - 4.8 in order
make validate    # runs the gates; nonzero exit on any failure
make report      # outputs/report.html
```

## Validation gates (do not ship past a failure)

1. Reproduce IIHS fleet averages (38 MY2020, 36 MY2017) within ±1.
2. Reproduce published class means (minicars 153, very large luxury cars 4, MY2020).
3. Reproduce the side-test effect: Good vs Poor ≈ 70% lower death risk in left-side crashes.
4. Placebo: side rating shows **no** significant effect on frontal survival.

If gate 3 fails, the entity resolution is broken — fix that before interpreting anything.

## Data source notes

- **IIHS death rates**: the ratings page is JS-rendered; `iihs_death_rates.py`
  hits the grid's JSON endpoint and snapshots the raw response per pull. If the
  endpoint is gated it falls back to parsing the Status Report PDFs
  (MY2020 -> Vol. 58; MY2017 -> Vol. 55 No. 2; MY2014 -> Vol. 52 No. 3;
  MY2011 -> Vol. 50 No. 1; MY2008 -> standalone under /media/). CI bounds are
  always captured — many "0" rates have upper bounds of 20–35.
- **FARS/CRSS**: annual zips from nhtsa.gov/file-downloads. CRSS counts are
  survey-weighted (`WEIGHT` column); raw counts are never used as denominators.
- **IIHS pooling**: a death-rate row may span e.g. 2017–2020 model years; it is
  exploded to individual years for FARS joins and re-aggregated afterward.

## Known limitations (stated in the report)

- Death rates adjust for driver age/sex only — not income, mileage, road mix,
  or driving style.
- "MY2020" is a design generation (up to 3 pooled prior model years), not a year.
- Low-volume makes below the 100k RVY / 20-death threshold are structurally
  absent. Absence is not safety.
- Selection into vehicle class is not random; nothing here is causal.
