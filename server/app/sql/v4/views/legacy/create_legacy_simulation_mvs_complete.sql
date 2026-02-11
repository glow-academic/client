-- Legacy compatibility MVs for queries that still reference old analytics/history names.

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_analytics CASCADE;

CREATE MATERIALIZED VIEW mv_simulation_analytics AS
SELECT
    cf.chat_id,
    cf.attempt_id,
    cf.profile_id,
    cf.simulation_id,
    cf.attempt_type,
    cf.is_archived,
    cf.completed,
    cf.grade_percent
FROM mv_chat_facts cf
WITH NO DATA;

CREATE UNIQUE INDEX mv_simulation_analytics_pk
    ON mv_simulation_analytics (chat_id);

CREATE INDEX mv_simulation_analytics_profile_id_idx
    ON mv_simulation_analytics (profile_id);

CREATE INDEX mv_simulation_analytics_simulation_id_idx
    ON mv_simulation_analytics (simulation_id);

CREATE INDEX mv_simulation_analytics_attempt_id_idx
    ON mv_simulation_analytics (attempt_id);

REFRESH MATERIALIZED VIEW mv_simulation_analytics;

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_history CASCADE;

CREATE MATERIALIZED VIEW mv_simulation_history AS
SELECT
    af.attempt_id,
    af.attempt_created_at,
    af.profile_id,
    af.simulation_id,
    af.cohort_id,
    af.department_id,
    (af.attempt_type = 'practice') AS practice,
    af.infinite_mode,
    af.is_archived,
    af.num_chats,
    af.num_chats_completed,
    af.num_scenarios,
    af.num_scenarios_completed,
    af.score_percent,
    af.has_passed,
    af.total_time_seconds,
    af.rubric_total_points,
    af.rubric_pass_points,
    af.scenario_ids,
    af.persona_ids
FROM mv_attempt_facts af
WITH NO DATA;

CREATE UNIQUE INDEX mv_simulation_history_pk
    ON mv_simulation_history (attempt_id);

CREATE INDEX mv_simulation_history_profile_id_idx
    ON mv_simulation_history (profile_id);

CREATE INDEX mv_simulation_history_simulation_id_idx
    ON mv_simulation_history (simulation_id);

CREATE INDEX mv_simulation_history_created_at_idx
    ON mv_simulation_history (attempt_created_at DESC);

REFRESH MATERIALIZED VIEW mv_simulation_history;
