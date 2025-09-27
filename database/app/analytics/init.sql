-- Adjust schema name if needed (e.g., public)
CREATE MATERIALIZED VIEW IF NOT EXISTS chat_analytics_mv AS
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
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(
           SELECT DISTINCT c.id
           FROM cohorts c
           WHERE s.id = ANY(c.simulation_ids)
         ) AS cohort_ids
  FROM simulations s
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
message_deltas AS (
  SELECT
    m.chat_id,
    GREATEST(
      EXTRACT(EPOCH FROM (
        m.created_at
        - COALESCE(
            LAG(COALESCE(m.updated_at, m.created_at))
              OVER (PARTITION BY m.chat_id ORDER BY m.created_at),
            sc.created_at
          )
      ))::int,
      0
    ) AS delta_seconds,
    m.created_at
  FROM simulation_messages m
  JOIN simulation_chats sc ON sc.id = m.chat_id
),
message_deltas_agg AS (
  SELECT chat_id,
         ARRAY_AGG(delta_seconds ORDER BY created_at)::int[] AS message_time_taken_seconds
  FROM message_deltas
  GROUP BY chat_id
)
SELECT
  -- Row grain: one row per chat
  sc.id                         AS chat_id,
  sc.attempt_id                 AS attempt_id,
  sa.profile_id                 AS profile_id,
  sa.simulation_id              AS simulation_id,

  -- Scenarios (root + leaf)
  rm.root_scenario_id           AS scenario_id,         -- root
  rm.leaf_scenario_id           AS leaf_scenario_id,    -- leaf used in the chat

  -- Persona (from the scenario used by this chat)
  s.persona_id                  AS persona_id,
  p.color                       AS persona_color,

  -- Filter-ready flags/fields
  sim.practice_simulation       AS is_practice,
  sa.archived                   AS is_archived,
  (NOT sim.practice_simulation AND NOT sa.archived) AS is_general,
  pr.role                       AS profile_role,
  cbs.cohort_ids                AS cohort_ids,          -- uuid[] (nullable)
  sc.created_at                 AS chat_created_at,
  sc.completed_at               AS chat_completed_at,

  -- Grades (latest only)
  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.points = 0 THEN NULL
    ELSE (lg.score / r.points) * 100.0
  END                           AS grade_percent,       -- 0..100, NULL if no grade
  CASE
    WHEN lg.score IS NULL OR r.points IS NULL OR r.pass_points IS NULL THEN NULL
    ELSE (lg.score >= r.pass_points)
  END                           AS passed,
  lg.time_taken_seconds         AS time_taken_seconds,  -- from latest grade (seconds)

  -- Completion (intuitive flag you requested)
  (sc.completed
   OR sc.completed_at IS NOT NULL
   OR lg.simulation_chat_id IS NOT NULL) AS completed,

  -- Messages: counts and per-message deltas
  COALESCE(mc.num_messages_total, 0)        AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)        AS num_query_messages,
  COALESCE(mc.num_response_messages, 0)     AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}') AS message_time_taken_seconds

FROM simulation_chats sc
JOIN simulation_attempts sa ON sa.id = sc.attempt_id
JOIN simulations sim       ON sim.id = sa.simulation_id
JOIN profiles    pr        ON pr.id  = sa.profile_id
JOIN scenarios   s         ON s.id   = sc.scenario_id            -- leaf scenario used
JOIN root_map    rm        ON rm.leaf_scenario_id = s.id
LEFT JOIN personas p       ON p.id  = s.persona_id
LEFT JOIN latest_grade lg  ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r        ON r.id  = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = sa.simulation_id
LEFT JOIN message_counts mc   ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
WITH NO DATA;

-- Unique index required for CONCURRENT refresh
CREATE UNIQUE INDEX IF NOT EXISTS chat_analytics_mv_pk
  ON chat_analytics_mv (chat_id);

-- Filter/slicing indexes
CREATE INDEX IF NOT EXISTS chat_analytics_mv_simulation_id_idx
  ON chat_analytics_mv (simulation_id);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_profile_id_idx
  ON chat_analytics_mv (profile_id);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_scenario_id_idx
  ON chat_analytics_mv (scenario_id);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_leaf_scenario_id_idx
  ON chat_analytics_mv (leaf_scenario_id);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_chat_created_at_idx
  ON chat_analytics_mv (chat_created_at);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_is_practice_idx
  ON chat_analytics_mv (is_practice);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_is_archived_idx
  ON chat_analytics_mv (is_archived);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_is_general_idx
  ON chat_analytics_mv (is_general);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_profile_role_idx
  ON chat_analytics_mv (profile_role);

-- GIN for array membership filtering on cohort_ids
CREATE INDEX IF NOT EXISTS chat_analytics_mv_cohort_ids_gin
  ON chat_analytics_mv USING GIN (cohort_ids);

-- Optional: fast pass-rate and time-range scans
CREATE INDEX IF NOT EXISTS chat_analytics_mv_passed_idx
  ON chat_analytics_mv (passed);

CREATE INDEX IF NOT EXISTS chat_analytics_mv_time_taken_idx
  ON chat_analytics_mv (time_taken_seconds);

-- Smart refresh: non-concurrent the first time, concurrent thereafter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'm'
      AND n.nspname = 'public'
      AND c.relname = 'chat_analytics_mv'
      AND c.relispopulated
  ) THEN
    -- initial load
    REFRESH MATERIALIZED VIEW chat_analytics_mv;
  ELSE
    -- subsequent runs
    REFRESH MATERIALIZED VIEW CONCURRENTLY chat_analytics_mv;
  END IF;
END $$;
