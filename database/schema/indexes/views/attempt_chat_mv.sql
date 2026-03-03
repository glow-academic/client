-- Indexes for materialized view: attempt_chat_mv
--

CREATE UNIQUE INDEX attempt_chat_mv_pk
    ON attempt_chat_mv (chat_id, attempt_id);

CREATE INDEX attempt_chat_mv_profile_id_idx
    ON attempt_chat_mv (profile_id);

CREATE INDEX attempt_chat_mv_cohort_id_idx
    ON attempt_chat_mv (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_department_id_idx
    ON attempt_chat_mv (department_id)
    WHERE department_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_simulation_id_idx
    ON attempt_chat_mv (simulation_id);

CREATE INDEX attempt_chat_mv_scenario_id_idx
    ON attempt_chat_mv (scenario_id)
    WHERE scenario_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_rubric_id_idx
    ON attempt_chat_mv (rubric_id)
    WHERE rubric_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_attempt_id_idx
    ON attempt_chat_mv (attempt_id);

CREATE INDEX attempt_chat_mv_attempt_date_idx
    ON attempt_chat_mv (attempt_date DESC);

CREATE INDEX attempt_chat_mv_attempt_type_idx
    ON attempt_chat_mv (attempt_type);

CREATE INDEX attempt_chat_mv_is_archived_idx
    ON attempt_chat_mv (is_archived);

CREATE INDEX attempt_chat_mv_profile_date_idx
    ON attempt_chat_mv (profile_id, attempt_date DESC);

CREATE INDEX attempt_chat_mv_profile_type_archived_idx
    ON attempt_chat_mv (profile_id, attempt_type, is_archived, attempt_date DESC);

CREATE INDEX attempt_chat_mv_default_idx
    ON attempt_chat_mv (profile_id, attempt_date DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

CREATE INDEX attempt_chat_mv_grade_idx
    ON attempt_chat_mv (grade_score DESC NULLS LAST)
    WHERE grade_score IS NOT NULL;

CREATE INDEX attempt_chat_mv_cohort_date_sim_idx
    ON attempt_chat_mv (cohort_id, attempt_date DESC, simulation_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_profile_sim_attempt_idx
    ON attempt_chat_mv (profile_id, simulation_id, attempt_number);

CREATE INDEX attempt_chat_mv_sim_scenario_idx
    ON attempt_chat_mv (simulation_id, scenario_id);

CREATE INDEX attempt_chat_mv_scenario_date_idx
    ON attempt_chat_mv (scenario_id, attempt_date DESC)
    WHERE scenario_id IS NOT NULL;

CREATE INDEX attempt_chat_mv_persona_refs_idx
    ON attempt_chat_mv USING GIN (persona_refs)
    WHERE persona_refs IS NOT NULL;

CREATE INDEX attempt_chat_mv_rubric_chat_idx
    ON attempt_chat_mv (rubric_id, chat_id)
    WHERE rubric_id IS NOT NULL;
