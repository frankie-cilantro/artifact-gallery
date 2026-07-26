-- Star-ish schema, one DuckDB file. FARS facts partitioned by year at the
-- parquet layer; vehicle_key indexed via ART on the fact tables.

CREATE TABLE IF NOT EXISTS dim_vehicle (
    vehicle_key      INTEGER PRIMARY KEY,
    nameplate        VARCHAR NOT NULL,
    make             VARCHAR,
    model_year_span  VARCHAR,
    class            VARCHAR,
    drivetrain       VARCHAR,
    curb_weight      DOUBLE,
    luxury_flag      BOOLEAN
);

CREATE TABLE IF NOT EXISTS fact_death_rate (
    vehicle_key   INTEGER REFERENCES dim_vehicle(vehicle_key),
    study_cycle   VARCHAR,
    rate_overall  DOUBLE,
    ci_lo         DOUBLE,
    ci_hi         DOUBLE,
    rate_mv       DOUBLE,
    rate_sv       DOUBLE,
    rate_sv_roll  DOUBLE,
    exposure_rvy  DOUBLE
);

CREATE TABLE IF NOT EXISTS fact_rating (
    vehicle_key        INTEGER REFERENCES dim_vehicle(vehicle_key),
    test_name          VARCHAR,
    rating_ord         INTEGER,   -- Good=4 ... Poor=1
    rating_raw         VARCHAR,
    measurement_value  DOUBLE,    -- e.g. B-pillar intrusion; more signal than the ordinal
    rating_year        INTEGER
);

CREATE TABLE IF NOT EXISTS fact_award (
    vehicle_key  INTEGER REFERENCES dim_vehicle(vehicle_key),
    award_year   INTEGER,
    award_level  VARCHAR    -- TSP / TSP+
);

CREATE TABLE IF NOT EXISTS fact_fars_crash (
    crash_id      VARCHAR,
    vehicle_key   INTEGER,
    year          INTEGER,
    impact_point  INTEGER,
    road_class    VARCHAR,
    speed_limit   INTEGER,
    n_vehicles    INTEGER,
    driver_age    INTEGER,
    driver_sex    INTEGER,
    restraint     INTEGER,
    alcohol       INTEGER,
    fatal_driver  BOOLEAN
);

CREATE TABLE IF NOT EXISTS fact_crss_involve (
    crash_id       VARCHAR,
    vehicle_key    INTEGER,
    year           INTEGER,
    impact_point   INTEGER,
    road_class     VARCHAR,
    speed_limit    INTEGER,
    n_vehicles     INTEGER,
    driver_age     INTEGER,
    driver_sex     INTEGER,
    restraint      INTEGER,
    fatal_driver   BOOLEAN,   -- almost always FALSE; CRSS covers non-fatal too
    survey_weight  DOUBLE NOT NULL  -- complex sample: never count rows unweighted
);

CREATE INDEX IF NOT EXISTS idx_fars_vkey ON fact_fars_crash (vehicle_key);
CREATE INDEX IF NOT EXISTS idx_crss_vkey ON fact_crss_involve (vehicle_key);
CREATE INDEX IF NOT EXISTS idx_fars_year ON fact_fars_crash (year);
