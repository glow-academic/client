-- Indexes for materialized view: practice_mv
--

CREATE UNIQUE INDEX practice_mv_pk
    ON practice_mv (practice_id);

CREATE INDEX practice_mv_simulation_ids_gin_idx
    ON practice_mv USING GIN (simulation_ids);

CREATE INDEX practice_mv_cohort_ids_gin_idx
    ON practice_mv USING GIN (cohort_ids);

CREATE INDEX practice_mv_profile_ids_gin_idx
    ON practice_mv USING GIN (profile_ids);

CREATE INDEX practice_mv_scenario_ids_gin_idx
    ON practice_mv USING GIN (scenario_ids);
