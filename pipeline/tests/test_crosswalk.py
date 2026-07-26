import pandas as pd
import pytest

from vsa.crosswalk import explode_model_years, norm_body, norm_drivetrain, load_crosswalk


def test_drivetrain_normalization():
    assert norm_drivetrain("quattro") == "AWD"
    assert norm_drivetrain("xDrive") == "AWD"
    assert norm_drivetrain("4Matic") == "AWD"
    assert norm_drivetrain("FWD") == "2WD"
    assert norm_drivetrain("4x4") == "4WD"
    assert norm_drivetrain("2WD") == "2WD"


def test_body_normalization():
    assert norm_body("Crew Cab short bed") == "crew cab"
    assert norm_body("SuperCrew") == "crew cab"
    assert norm_body("4-door saloon") == "sedan"
    assert norm_body("Estate") == "wagon"


def test_explode_model_years_pooled_span():
    df = pd.DataFrame([{"nameplate": "X", "model_years": "2017-20"}])
    out = explode_model_years(df)
    assert sorted(out["model_year"]) == [2017, 2018, 2019, 2020]


def test_explode_model_years_single_year():
    df = pd.DataFrame([{"nameplate": "X", "model_years": "2020"}])
    assert explode_model_years(df)["model_year"].tolist() == [2020]


def test_explode_model_years_full_end_year():
    df = pd.DataFrame([{"nameplate": "X", "model_years": "2018-2020"}])
    assert len(explode_model_years(df)) == 3


def test_explode_rejects_garbage():
    with pytest.raises(ValueError):
        explode_model_years(pd.DataFrame([{"nameplate": "X", "model_years": "n/a"}]))


def test_seed_crosswalk_loads_and_is_unique():
    xw = load_crosswalk()
    assert not xw.empty
    assert not xw.duplicated(["iihs_name", "drivetrain"]).any()
