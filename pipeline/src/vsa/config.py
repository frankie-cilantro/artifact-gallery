from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[2]
DATA = PIPELINE_ROOT / "data"
RAW = DATA / "raw"
CROSSWALK_CSV = DATA / "crosswalk" / "crosswalk.csv"
OUTPUTS = PIPELINE_ROOT / "outputs"
DB_PATH = PIPELINE_ROOT / "vsa.duckdb"

# IIHS driver-death-rate study cycles: cycle label -> (model_year, Status Report fallback PDF)
# The visible ratings page is a JS shell; DEATH_RATE_ENDPOINT is the XHR the grid
# fetches. Re-capture via DevTools -> Network -> XHR if IIHS moves it, and update here.
DEATH_RATE_PAGE = "https://www.iihs.org/ratings/driver-death-rates-by-make-and-model"
DEATH_RATE_ENDPOINT = "https://www.iihs.org/api/driverdeathrates"  # verify per pull; snapshot raw response

STUDY_CYCLES = {
    "MY2020": {"model_year": 2020, "status_report": "Vol. 58 (2023)"},
    "MY2017": {"model_year": 2017, "status_report": "Vol. 55 No. 2"},
    "MY2014": {"model_year": 2014, "status_report": "Vol. 52 No. 3"},
    "MY2011": {"model_year": 2011, "status_report": "Vol. 50 No. 1"},
    "MY2008": {"model_year": 2008, "status_report": "standalone /media/ PDF"},
}

FARS_YEARS = range(2015, 2024)
FARS_BASE = "https://static.nhtsa.gov/nhtsa/downloads/FARS"
CRSS_BASE = "https://static.nhtsa.gov/nhtsa/downloads/CRSS"
VPIC_BATCH_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/"

RATING_ORD = {"G": 4, "A": 3, "M": 2, "P": 1,
              "Good": 4, "Acceptable": 3, "Marginal": 2, "Poor": 1}

# Tests matched to crash direction for the conditional survival model (4.5).
# Cross-direction fits are placebo checks.
DIRECTION_TESTS = {
    "frontal": ["moderate_overlap_front", "moderate_overlap_front_updated",
                "small_overlap_driver", "small_overlap_passenger"],
    "left_side": ["side_original", "side_updated"],
    "rollover": ["roof_strength"],
}

CEILING_SHARE = 0.90  # >90% Good in a model year => test flagged non-discriminating

# Validation gate targets (published IIHS figures)
GATES = {
    "fleet_avg": {"MY2020": 38, "MY2017": 36, "tolerance": 1.0},
    "class_means_MY2020": {"minicars": 153, "very large luxury cars": 4, "tolerance": 1.0},
    "side_effect_good_vs_poor": {"target_reduction": 0.70, "tolerance": 0.10},
}
