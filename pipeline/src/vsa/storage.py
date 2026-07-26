"""DuckDB loaders: resolved entities + raw pulls -> star schema in vsa.duckdb."""
from __future__ import annotations

from pathlib import Path

import duckdb
import pandas as pd

from .config import DB_PATH, RAW
from .crosswalk import explode_model_years, resolve

SCHEMA = Path(__file__).with_name("schema.sql")

# FARS/CRSS IMPACT1 -> analysis direction buckets
FRONTAL = set(range(11, 13)) | {1, 12}      # 11,12,1 o'clock
LEFT_SIDE = {8, 9, 10}
RIGHT_SIDE = {2, 3, 4}


def impact_direction(impact1, rollover) -> str:
    if pd.notna(rollover) and int(rollover) > 0:
        return "rollover"
    if pd.isna(impact1):
        return "unknown"
    p = int(impact1)
    if p in FRONTAL:
        return "frontal"
    if p in LEFT_SIDE:
        return "left_side"
    if p in RIGHT_SIDE:
        return "right_side"
    return "other"


def connect() -> duckdb.DuckDBPyConnection:
    con = duckdb.connect(str(DB_PATH))
    con.execute(SCHEMA.read_text())
    return con


def load() -> None:
    con = connect()
    try:
        resolved = resolve()
    except SystemExit as e:
        # Aggregate mode: the IIHS pull carries class + drivetrain natively, so
        # the aggregate-level phases (4.1-4.4, 4.7, gates 1-2) can run without
        # the FARS crosswalk. Crash-level tables stay empty until the crosswalk
        # covers the fleet.
        print(f"crosswalk incomplete — falling back to IIHS-native dimension\n({e})")
        resolved = pd.read_parquet(RAW / "iihs_death_rates" / "death_rates.parquet")
        resolved["luxury_flag"] = resolved["class"].str.contains("luxury", case=False)

    dim = (resolved[["nameplate", "class", "drivetrain", "model_years", "luxury_flag"]]
           .drop_duplicates(["nameplate", "drivetrain", "model_years"])
           .reset_index(drop=True))
    dim["vehicle_key"] = dim.index + 1
    dim["make"] = dim["nameplate"].str.split().str[0]
    dim = dim.rename(columns={"model_years": "model_year_span"})

    dim["curb_weight"] = _curb_weights(dim, resolved)

    con.execute("DELETE FROM dim_vehicle")
    con.register("dim_df", dim)
    con.execute("""INSERT INTO dim_vehicle
        SELECT vehicle_key, nameplate, make, model_year_span, class, drivetrain,
               curb_weight, CAST(luxury_flag AS BOOLEAN) FROM dim_df""")

    fdr = resolved.merge(dim[["nameplate", "drivetrain", "model_year_span", "vehicle_key"]],
                         left_on=["nameplate", "drivetrain", "model_years"],
                         right_on=["nameplate", "drivetrain", "model_year_span"])
    con.execute("DELETE FROM fact_death_rate")
    con.register("fdr", fdr)
    con.execute("""INSERT INTO fact_death_rate
        SELECT vehicle_key, cycle, rate_overall, ci_lo, ci_hi,
               rate_mv, rate_sv, rate_sv_roll, exposure_rvy FROM fdr""")

    ratings = RAW / "iihs_ratings" / "ratings.parquet"
    if ratings.exists():
        r = pd.read_parquet(ratings).merge(
            dim[["nameplate", "vehicle_key"]].drop_duplicates("nameplate"),
            on="nameplate", how="inner")
        con.execute("DELETE FROM fact_rating; DELETE FROM fact_award")
        con.register("r", r[r.test_name != "award"])
        con.execute("""INSERT INTO fact_rating
            SELECT vehicle_key, test_name, rating_ord, rating_raw,
                   TRY_CAST(measurement_value AS DOUBLE), rating_year FROM r""")
        con.register("aw", r[r.test_name == "award"])
        con.execute("""INSERT INTO fact_award
            SELECT vehicle_key, rating_year, rating_raw FROM aw""")

    _load_crashes(con, dim)
    con.close()
    print(f"loaded {DB_PATH}")


def _curb_weights(dim: pd.DataFrame, resolved: pd.DataFrame) -> pd.Series:
    """Median vPIC curb weight per nameplate, joined through the FARS code
    pair: decoded VIN prefixes -> (MAKE, MODEL) codes -> crosswalk -> dim."""
    vpic_path = RAW / "vpic" / "vpic_decoded.parquet"
    if not vpic_path.exists() or "fars_make_code" not in resolved.columns:
        return pd.Series([None] * len(dim), index=dim.index, dtype="float64")
    from .ingest.vpic import study_vehicle_frames
    dec = pd.read_parquet(vpic_path)
    dec["curb_weight_lb"] = pd.to_numeric(dec["curb_weight_lb"], errors="coerce")
    dec = dec.dropna(subset=["curb_weight_lb"])[["vin", "curb_weight_lb"]]
    frames = [df[["vin_prefix", "MAKE", "MODEL"]] for df in study_vehicle_frames()]
    veh = pd.concat(frames, ignore_index=True).merge(
        dec, left_on="vin_prefix", right_on="vin")
    per_code = (veh.groupby(["MAKE", "MODEL"])["curb_weight_lb"].median()
                .rename("curb_weight").reset_index())
    codes = (resolved[["nameplate", "fars_make_code", "fars_model_code"]]
             .dropna().drop_duplicates("nameplate"))
    codes[["fars_make_code", "fars_model_code"]] = \
        codes[["fars_make_code", "fars_model_code"]].astype(int)
    codes = codes.merge(per_code, left_on=["fars_make_code", "fars_model_code"],
                        right_on=["MAKE", "MODEL"], how="left")
    return dim["nameplate"].map(codes.set_index("nameplate")["curb_weight"])


def _crash_frames(source_dir: Path, dim: pd.DataFrame, crss: bool):
    from .crosswalk import norm_drivetrain
    xw = pd.read_parquet(RAW / "iihs_death_rates" / "death_rates.parquet")
    xw["drivetrain"] = xw["drivetrain"].map(norm_drivetrain)
    exploded = explode_model_years(
        xw.merge(dim[["nameplate", "drivetrain", "model_year_span", "vehicle_key"]],
                 left_on=["nameplate", "drivetrain", "model_years"],
                 right_on=["nameplate", "drivetrain", "model_year_span"]))
    # nameplate resolution to FARS make/model codes happens through the
    # crosswalk columns already merged onto `exploded` upstream in resolve()
    from .crosswalk import load_crosswalk
    codes = load_crosswalk()
    key = exploded.merge(codes, left_on=["nameplate", "drivetrain"],
                         right_on=["iihs_name", "drivetrain"])
    # Several IIHS variants (cab/bed styles, 2WD/4WD) share one FARS code
    # pair; joining all of them would count each crash once per variant.
    # Keep the highest-exposure variant per (code pair, model year) so every
    # crash row lands exactly once.
    key = (key[["vehicle_key", "fars_make_code", "fars_model_code",
                "model_year", "exposure_rvy"]]
           .astype({"fars_make_code": int, "fars_model_code": int})
           .sort_values("exposure_rvy", ascending=False)
           .drop_duplicates(["fars_make_code", "fars_model_code", "model_year"])
           .drop(columns=["exposure_rvy"]))

    id_col = "CASENUM" if crss else "ST_CASE"
    for vp in sorted(source_dir.glob("vehicle_*.parquet")):
        year = int(vp.stem.split("_")[1])
        veh = pd.read_parquet(vp)
        per = pd.read_parquet(source_dir / f"person_{year}.parquet")
        acc = pd.read_parquet(source_dir / f"accident_{year}.parquet")
        drivers = per[per["PER_TYP"] == 1]  # driver
        m = (veh.merge(key, left_on=["MAKE", "MODEL", "MOD_YEAR"],
                       right_on=["fars_make_code", "fars_model_code", "model_year"])
                .merge(drivers, on=[id_col, "VEH_NO"], how="left")
                .merge(acc, on=id_col, how="left", suffixes=("", "_acc")))
        # FARS 2015+ and CRSS both carry the speed limit on the vehicle record
        # (VSPD_LIM); 0/98/99 are no-limit/not-reported codes.
        if "SP_LIMIT" not in m.columns and "VSPD_LIM" in m.columns:
            m["SP_LIMIT"] = m["VSPD_LIM"]
        if "SP_LIMIT" in m.columns:
            m.loc[~m["SP_LIMIT"].between(5, 90), "SP_LIMIT"] = pd.NA
        # road_class harmonized to urban/rural — the only stratum both sources
        # share (FARS RUR_URB: 1=rural 2=urban; CRSS URBANICITY: 1=urban 2=rural)
        if "RUR_URB" in m.columns:
            m["ROAD_CLASS"] = m["RUR_URB"].map({1: "rural", 2: "urban"})
        elif "URBANICITY" in m.columns:
            m["ROAD_CLASS"] = m["URBANICITY"].map({1: "urban", 2: "rural"})
        if "AGE" in m.columns:
            m.loc[m["AGE"] >= 120, "AGE"] = pd.NA  # 998/999 unknown codes
        if "SEX" in m.columns:
            m.loc[~m["SEX"].isin([1, 2]), "SEX"] = pd.NA
        m["direction"] = [impact_direction(i, r) for i, r in
                          zip(m.get("IMPACT1"), m.get("ROLLOVER"))]
        m["fatal_driver"] = m.get("INJ_SEV", pd.Series(dtype=float)).eq(4)
        m["year"] = year
        yield m, id_col


def _load_crashes(con, dim: pd.DataFrame) -> None:
    for source, table, crss in [(RAW / "fars", "fact_fars_crash", False),
                                (RAW / "crss", "fact_crss_involve", True)]:
        if not source.exists() or not any(source.glob("vehicle_*.parquet")):
            print(f"skip {table}: no source files under {source}")
            continue
        con.execute(f"DELETE FROM {table}")
        for m, id_col in _crash_frames(source, dim, crss):
            m["crash_id"] = m[id_col].astype(str) + "-" + m["year"].astype(str)
            cols = {"crash_id": "crash_id", "vehicle_key": "vehicle_key",
                    "year": "year", "IMPACT1": "impact_point",
                    "ROAD_CLASS": "road_class", "SP_LIMIT": "speed_limit",
                    "VE_TOTAL": "n_vehicles", "AGE": "driver_age",
                    "SEX": "driver_sex", "REST_USE": "restraint",
                    "fatal_driver": "fatal_driver"}
            if not crss:
                cols["DRINKING"] = "alcohol"
            else:
                cols["WEIGHT"] = "survey_weight"
            frame = m[[c for c in cols if c in m.columns]].rename(columns=cols)
            con.register("frame", frame)
            collist = ", ".join(frame.columns)
            con.execute(f"INSERT INTO {table} ({collist}) SELECT {collist} FROM frame")
        n = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        print(f"{table}: {n} rows")
