# Handoff: finish the vehicle safety analytics pipeline (Phase FARS/CRSS)

Paste this into a fresh Claude Code session with this repo checked out.
Work on branch `claude/vehicle-safety-analytics-h90hwi`.

---

## Prompt

You are finishing the vehicle safety analytics pipeline in `pipeline/`.
Read `pipeline/README.md` first. The IIHS side is DONE and validated:
1,008 death-rate rows (data/processed/death_rates.csv), 1,098 crash-test
ratings, analyses 4.1–4.4 and 4.6–4.7 run for real, validation gates 1–2
pass exactly. Your job is the crash-level half: FARS + CRSS + vPIC +
crosswalk, then the conditional survival model (4.5) and gates 3–4.

Environment notes: `cd pipeline && python -m venv .venv && . .venv/bin/activate
&& pip install -r requirements.txt`. Run stages with `PYTHONPATH=src python -m
vsa <stage>` (see Makefile). Everything raw gets snapshotted under `data/raw/`
automatically. Total downloads are ~1 GB compressed; kept columns land as small
parquets — do NOT skip years to save disk unless the container genuinely runs out.

Do these in order:

1. **Download FARS 2016–2023** (`python -m vsa ingest-fars`). URL pattern in
   `src/vsa/ingest/fars.py` (`FARS{year}NationalCSV.zip`); verify against
   nhtsa.gov/file-downloads and fix the pattern if NHTSA moved files. Same for
   **CRSS** (`ingest-crss`). CRSS survey WEIGHT columns are asserted — if the
   assert fires, find the weight column's new name, don't delete the assert.

2. **Build the crosswalk semi-automatically** (this was planned as hand-work;
   automate it): FARS vehicle rows have VINs. Decode a sample of VINs per
   FARS MAKE/MODEL code via vPIC (`src/vsa/ingest/vpic.py`) to get make/model
   strings, then fuzzy-match those strings to the 252 IIHS nameplates in
   `data/processed/death_rates.csv` (MY2017+MY2020 cycles). Write results into
   `data/crosswalk/crosswalk.csv` (schema in `src/vsa/crosswalk.py`;
   `luxury_flag` = class name contains "luxury"). Emit a review file of
   low-confidence matches. `python -m vsa resolve` must pass for every
   MY2017/MY2020 row — it fails loudly and lists what's unresolved; fix by
   adding rows, never by dropping vehicles. Older cycles (MY2002–MY2014) may
   stay unresolved; keep the IIHS-native fallback for them.

3. **Decode curb weights** (`ingest-vpic`), then `python -m vsa load`. Check
   fact_fars_crash and fact_crss_involve are populated and that the
   fars_make_code/fars_model_code join in `src/vsa/storage.py` matches on the
   right dtypes (FARS codes are ints, watch for zero-padding).

4. **Run `python -m vsa analyze` then `validate`.** Gates 3 and 4 now run for
   real:
   - Gate 3: Good-vs-Poor side rating ≈ 70% lower death risk in left-side
     crashes. If it fails, the crosswalk or the impact-direction bucketing in
     `storage.py` is wrong — debug there, do not loosen the gate.
   - Gate 4: side rating must show NO significant effect on frontal survival
     (placebo). If it fails, report it as residual confounding — that is a
     finding, not a bug to silence.
   Note the original side test is ceiling-flagged for MY2020 (99% Good) — the
   survival model auto-excludes ceiling tests; the side-effect gate therefore
   leans on MY2017-era variation. If left-side data is too thin, say so
   explicitly in the report rather than stretching.

5. **Re-run `report`, refresh variance decomposition** (curb_weight block now
   active), export new CSVs to `outputs/`, copy processed datasets to
   `data/processed/`, update the "Data status" plain-language section, commit
   and push to `claude/vehicle-safety-analytics-h90hwi`.

Ground rules: never commit raw FARS/CRSS files (gitignored; MANIFEST.md logs
pulls). Never use unweighted CRSS counts. State limitations plainly — no
causal language. If a validation gate fails, stop and report; do not interpret
results past a failing gate.

---

## Current state (2026-07-26)

| Piece | Status |
|---|---|
| IIHS death rates (API sweep, 7 cycles) | ✅ done, gates 1–2 exact |
| IIHS ratings (145/252 nameplates) | ✅ done; 51 misses logged in data/raw/iihs_ratings/ratings_misses.csv |
| Analyses 4.1–4.4, 4.6, 4.7 | ✅ run on real data |
| FARS / CRSS / vPIC / crosswalk / 4.5 / gates 3–4 | ⬜ this handoff |
| Mileage correction 4.8 | ⬜ optional, needs hand-supplied VMT csv |
| React gallery artifact | ⬜ only after numbers are stable |
