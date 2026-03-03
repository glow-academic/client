-- Indexes for materialized view: home_mv
--

CREATE UNIQUE INDEX home_mv_pk
    ON home_mv (home_id);

CREATE INDEX home_mv_simulation_ids_gin_idx
    ON home_mv USING GIN (simulation_ids);

CREATE INDEX home_mv_cohort_ids_gin_idx
    ON home_mv USING GIN (cohort_ids);

CREATE INDEX home_mv_profile_ids_gin_idx
    ON home_mv USING GIN (profile_ids);

CREATE INDEX home_mv_scenario_ids_gin_idx
    ON home_mv USING GIN (scenario_ids);
