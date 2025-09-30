-- Adjust schema name if needed (e.g., public)
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics AS
WITH RECURSIVE scenario_roots AS (
  -- Map every scenario.id to its root_id (follow parents to the top)
  SELECT id, parent_id, id AS root_id
  FROM scenarios
  WHERE parent_id IS NULL
  UNION ALL
  SELECT s.id, s.parent_id, sr.root_id
  FROM scenarios s
  JOIN scenario_roots sr ON s.parent_id = sr.id
),
root_map AS (
  SELECT s.id AS leaf_scenario_id,
         COALESCE(sr.root_id, s.id) AS root_scenario_id
  FROM scenarios s
  LEFT JOIN scenario_roots sr ON s.id = sr.id
),
latest_grade AS (
  SELECT DISTINCT ON (simulation_chat_id)
         simulation_chat_id,
         score::numeric AS score,
         time_taken::numeric AS time_taken_seconds,
         rubric_id,
         created_at
  FROM simulation_chat_grades
  ORDER BY simulation_chat_id, created_at DESC
),
-- only ACTIVE simulations
active_sims AS (
  SELECT * FROM simulations WHERE active = TRUE
),
-- only ACTIVE scenarios
active_scenarios AS (
  SELECT * FROM scenarios WHERE active = TRUE
),
-- expand cohorts; we'll filter active where needed
cohorts_expanded AS (
  SELECT c.id, c.active, c.simulation_ids, c.profile_ids
  FROM cohorts c
),
-- sims -> active cohorts (like your old cohorts_by_sim but active-only)
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(
           SELECT DISTINCT c.id
           FROM cohorts_expanded c
           WHERE c.active = TRUE AND s.id = ANY (c.simulation_ids)
         ) AS cohort_ids
  FROM active_sims s
),
-- profile ∩ simulation ∩ active cohort (for true cohort-mode semantics)
profile_cohorts_for_sim AS (
  SELECT
    sa.id AS attempt_id,
    sa.profile_id,
    sa.simulation_id,
    ARRAY(
      SELECT c.id
      FROM cohorts_expanded c
      WHERE c.active = TRUE
        AND sa.simulation_id = ANY (c.simulation_ids)
        AND sa.profile_id    = ANY (c.profile_ids)
    ) AS profile_cohort_ids
  FROM simulation_attempts sa
),
-- Message counts per chat (total + by type)
message_counts AS (
  SELECT
    sm.chat_id,
    COUNT(*)::int                                AS num_messages_total,
    COUNT(*) FILTER (WHERE sm.type = 'query')::int    AS num_query_messages,
    COUNT(*) FILTER (WHERE sm.type = 'response')::int AS num_response_messages
  FROM simulation_messages sm
  GROUP BY sm.chat_id
),
-- Per-message time deltas (seconds) computed in-order, then aggregated to int[]
-- Only measure persona "response → user query" gaps
message_deltas AS (
  SELECT
    m.chat_id,
    -- only response -> query gaps
    CASE
      WHEN lag(m.type) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'response'
       AND m.type = 'query'
      THEN GREATEST(
             EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at))
               OVER (PARTITION BY m.chat_id ORDER BY m.created_at), sc_1.created_at))::int, 0)
      ELSE NULL
    END AS delta_seconds,
    m.created_at
  FROM simulation_messages m
  JOIN simulation_chats sc_1 ON sc_1.id = m.chat_id
),
message_deltas_agg AS (
  SELECT chat_id,
         ARRAY_REMOVE(array_agg(delta_seconds ORDER BY created_at), NULL) AS message_time_taken_seconds
  FROM message_deltas
  GROUP BY chat_id
)
SELECT
  -- *** original columns kept in the same order as your "Old def" ***
  sc.id                         AS chat_id,
  sc.attempt_id                 AS attempt_id,
  sa.profile_id                 AS profile_id,
  sa.simulation_id              AS simulation_id,

  rm.root_scenario_id           AS scenario_id,
  rm.leaf_scenario_id           AS leaf_scenario_id,

  s.persona_id                  AS persona_id,
  p.color                       AS persona_color,

  sim.practice_simulation       AS is_practice,
  sa.archived                   AS is_archived,
  (NOT sim.practice_simulation AND NOT sa.archived) AS is_general,
  pr.role                       AS profile_role,
  cbs.cohort_ids                AS cohort_ids,
  sc.created_at                 AS chat_created_at,
  sc.completed_at               AS chat_completed_at,

  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL
    ELSE (lg.score / r.points::numeric) * 100.0
  END                           AS grade_percent,
  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL
    ELSE (lg.score >= r.pass_points::numeric)
  END                           AS passed,
  lg.time_taken_seconds         AS time_taken_seconds,

  lg.rubric_id                  AS rubric_id,
  r.points                      AS rubric_points,
  r.pass_points                 AS rubric_pass_points,

  (sc.completed OR sc.completed_at IS NOT NULL OR lg.simulation_chat_id IS NOT NULL)
                               AS completed,

  COALESCE(mc.num_messages_total, 0)            AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)            AS num_query_messages,
  COALESCE(mc.num_response_messages, 0)         AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}') AS message_time_taken_seconds,

  -- *** new trailing columns (safe append) ***
  sa.created_at                 AS attempt_created_at, -- use for date filters like TS did
  pcs.profile_cohort_ids        AS profile_cohort_ids, -- cohortIds "true membership"
  COALESCE(array_length(sim.scenario_ids, 1), 0) AS sim_scenario_count, -- simulation's expected scenario count
  lg.created_at                 AS grade_created_at -- grade creation time for stagnation metric
FROM simulation_chats sc
JOIN simulation_attempts sa   ON sa.id = sc.attempt_id
JOIN active_sims sim          ON sim.id = sa.simulation_id       -- enforce active simulation
JOIN profiles pr              ON pr.id = sa.profile_id
JOIN active_scenarios s       ON s.id = sc.scenario_id           -- enforce active scenario
JOIN root_map rm              ON rm.leaf_scenario_id = s.id
LEFT JOIN personas p          ON p.id = s.persona_id
LEFT JOIN latest_grade lg     ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r           ON r.id = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs  ON cbs.simulation_id = sa.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc   ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
WITH NO DATA;

-- Unique index required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS analytics_pk
  ON analytics (chat_id);

-- Filter/slicing indexes
CREATE INDEX IF NOT EXISTS analytics_simulation_id_idx
  ON analytics (simulation_id);

CREATE INDEX IF NOT EXISTS analytics_profile_id_idx
  ON analytics (profile_id);

CREATE INDEX IF NOT EXISTS analytics_scenario_id_idx
  ON analytics (scenario_id);

CREATE INDEX IF NOT EXISTS analytics_leaf_scenario_id_idx
  ON analytics (leaf_scenario_id);

CREATE INDEX IF NOT EXISTS analytics_chat_created_at_idx
  ON analytics (chat_created_at);

CREATE INDEX IF NOT EXISTS analytics_is_practice_idx
  ON analytics (is_practice);

CREATE INDEX IF NOT EXISTS analytics_is_archived_idx
  ON analytics (is_archived);

CREATE INDEX IF NOT EXISTS analytics_is_general_idx
  ON analytics (is_general);

CREATE INDEX IF NOT EXISTS analytics_profile_role_idx
  ON analytics (profile_role);

-- GIN for array membership filtering on cohort_ids
CREATE INDEX IF NOT EXISTS analytics_cohort_ids_gin
  ON analytics USING GIN (cohort_ids);

-- Optional: fast pass-rate and time-range scans
CREATE INDEX IF NOT EXISTS analytics_passed_idx
  ON analytics (passed);

CREATE INDEX IF NOT EXISTS analytics_time_taken_idx
  ON analytics (time_taken_seconds);

-- New: for cohort-mode membership & attempt-date filters
CREATE INDEX IF NOT EXISTS analytics_profile_cohort_ids_gin
  ON analytics USING GIN (profile_cohort_ids);
CREATE INDEX IF NOT EXISTS analytics_attempt_created_at_idx
  ON analytics (attempt_created_at);

-- Performance indexes for analytics functions
-- Latest grade per chat fast path
CREATE INDEX IF NOT EXISTS scg_chat_created_idx
  ON simulation_chat_grades (simulation_chat_id, created_at DESC);

-- Feedback lookup by grade
CREATE INDEX IF NOT EXISTS scf_grade_idx
  ON simulation_chat_feedbacks (simulation_chat_grade_id);

-- Standards mapping
CREATE INDEX IF NOT EXISTS standards_group_idx
  ON standards (standard_group_id);

-- Group ↔ rubric
CREATE INDEX IF NOT EXISTS standard_groups_rubric_idx
  ON standard_groups (id, rubric_id);

-- Analytics 'where' clause helpers
CREATE INDEX IF NOT EXISTS analytics_chat_created_idx
  ON analytics (chat_created_at);

CREATE INDEX IF NOT EXISTS analytics_chat_id_idx
  ON analytics (chat_id);

-- Additional analytics filtering indexes
CREATE INDEX IF NOT EXISTS analytics_simulation_idx
  ON analytics (simulation_id);

-- GIN for array overlaps (cohort filters)
CREATE INDEX IF NOT EXISTS analytics_cohorts_gin
  ON analytics USING GIN (cohort_ids);

CREATE INDEX IF NOT EXISTS analytics_profile_cohorts_gin
  ON analytics USING GIN (profile_cohort_ids);

-- Additional indexes for skill performance optimization
-- Latest grade per (chat, rubric) fast path
CREATE INDEX IF NOT EXISTS scg_chat_rubric_created_idx
  ON simulation_chat_grades (simulation_chat_id, rubric_id, created_at DESC);

-- Group id + rubric (we filter sg.rubric_id = lg.rubric_id)
CREATE INDEX IF NOT EXISTS standard_groups_id_rubric_idx
  ON standard_groups (id, rubric_id);

-- Performance optimization indexes for analytics functions
-- High-impact indexes on analytics matview for fast queries
CREATE INDEX IF NOT EXISTS analytics_attempt_created_at_idx
  ON analytics (attempt_created_at);

CREATE INDEX IF NOT EXISTS analytics_role_time_idx
  ON analytics (profile_role, attempt_created_at);

-- Partial indexes for common filter patterns
CREATE INDEX IF NOT EXISTS analytics_is_general_true_idx
  ON analytics (attempt_created_at) WHERE is_general = true;

CREATE INDEX IF NOT EXISTS analytics_is_practice_true_idx
  ON analytics (attempt_created_at) WHERE is_practice = true;

CREATE INDEX IF NOT EXISTS analytics_is_archived_true_idx
  ON analytics (attempt_created_at) WHERE is_archived = true;

-- Supporting table indexes for analytics functions
CREATE INDEX IF NOT EXISTS simulation_chat_grades_latest_idx
  ON simulation_chat_grades (simulation_chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS simulation_messages_chat_created_type_idx
  ON simulation_messages (chat_id, created_at, type);

CREATE INDEX IF NOT EXISTS simulation_chats_id_created_idx
  ON simulation_chats (id, created_at);

CREATE INDEX IF NOT EXISTS simulation_attempts_profile_sim_idx
  ON simulation_attempts (profile_id, simulation_id);

CREATE INDEX IF NOT EXISTS simulation_attempts_archived_idx
  ON simulation_attempts (archived);

-- Smart refresh: non-concurrent the first time, concurrent thereafter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'm'
      AND n.nspname = 'public'
      AND c.relname = 'analytics'
      AND c.relispopulated
  ) THEN
    -- initial load
    REFRESH MATERIALIZED VIEW analytics;
  ELSE
    -- subsequent runs
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics;
  END IF;
END $$;

-- Header
\i app/analytics/header/prep_average_score.sql
\i app/analytics/header/prep_completion_percentage.sql
\i app/analytics/header/prep_first_attempt_pass_rate.sql
\i app/analytics/header/prep_highest_score.sql
\i app/analytics/header/prep_messages_per_session.sql
\i app/analytics/header/prep_persona_response_times.sql
\i app/analytics/header/prep_session_efficiency.sql
\i app/analytics/header/prep_stagnation_rate.sql
\i app/analytics/header/prep_time_spent.sql
\i app/analytics/header/prep_total_attempts.sql

-- Leaderboard
\i app/analytics/leaderboard/prep_improvement_per_day.sql
\i app/analytics/leaderboard/prep_perfect_scores.sql
\i app/analytics/leaderboard/prep_quickest_pass.sql

-- Primary Analytics Functions
\i app/analytics/primary/helpers.sql
\i app/analytics/primary/rubric_heatmap.sql
\i app/analytics/primary/growth_data.sql
\i app/analytics/primary/persona_performance.sql

-- Secondary Analytics Functions
\i app/analytics/secondary/attempt_improvement.sql
\i app/analytics/secondary/cohort_performance.sql
\i app/analytics/secondary/skill_performance.sql

-- Footer Analytics Functions
\i app/analytics/footer/scenario_performance.sql
\i app/analytics/footer/simulation_composition.sql
\i app/analytics/footer/simulation_performance.sql
\i app/analytics/footer/scenario_stats.sql

-- Home Analytics Functions
\i app/analytics/home/analytics_home_overview.sql

-- History Analytics Functions
\i app/analytics/history/attempt_history.sql

-- Practice Analytics Functions
\i app/analytics/practice/analytics_practice_overview.sql