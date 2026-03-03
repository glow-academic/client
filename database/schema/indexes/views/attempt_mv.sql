-- Indexes for materialized view: attempt_mv
--

CREATE UNIQUE INDEX attempt_mv_pk
    ON attempt_mv (attempt_id);

CREATE INDEX attempt_mv_practice_idx
    ON attempt_mv (practice);

CREATE INDEX attempt_mv_profile_id_idx
    ON attempt_mv (profile_id);

CREATE INDEX attempt_mv_simulation_id_idx
    ON attempt_mv (simulation_id);

CREATE INDEX attempt_mv_cohort_id_idx
    ON attempt_mv (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX attempt_mv_department_id_idx
    ON attempt_mv (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX attempt_mv_created_at_idx
    ON attempt_mv (attempt_created_at DESC);

CREATE INDEX attempt_mv_profile_simulation_idx
    ON attempt_mv (profile_id, simulation_id);

CREATE INDEX attempt_mv_practice_profile_idx
    ON attempt_mv (practice, profile_id);

CREATE INDEX attempt_mv_is_archived_idx
    ON attempt_mv (is_archived);

CREATE INDEX attempt_mv_scenario_ids_gin
    ON attempt_mv USING GIN (scenario_ids);
