-- Adjust schema name if needed (e.g., public)
CREATE MATERIALIZED VIEW IF NOT EXISTS analytics AS
WITH RECURSIVE scenario_roots AS (
  -- Map every scenario.id to its root_id using scenario_tree (self-edge = root)
  SELECT s.id, st.parent_id, s.id AS root_id
  FROM scenarios s
  JOIN scenario_tree st ON st.child_id = s.id AND st.parent_id = s.id -- self-edge = root
  UNION ALL
  SELECT s1.id, st.parent_id, sr.root_id
  FROM scenarios s1
  JOIN scenario_tree st ON st.child_id = s1.id AND st.parent_id <> s1.id
  JOIN scenario_roots sr ON st.parent_id = sr.id
),
root_map AS (
  SELECT s.id AS leaf_scenario_id,
         COALESCE(sr.root_id, s.id) AS root_scenario_id
  FROM scenarios s
  LEFT JOIN scenario_roots sr ON s.id = sr.id
),
latest_grade AS (
  SELECT DISTINCT ON (rc.chat_id)
         rc.chat_id AS simulation_chat_id,
         g.score::numeric AS score,
         g.time_taken::numeric AS time_taken_seconds,
         g.rubric_id,
         g.created_at
  FROM grades g
  JOIN runs r ON r.id = g.run_id
  JOIN chat_runs rc ON rc.run_id = r.id
  WHERE g.eval = false
  ORDER BY rc.chat_id, g.created_at DESC
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
  SELECT c.id, c.active FROM cohorts c
),
-- sims -> active cohorts using junction table
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(SELECT DISTINCT c.id FROM cohorts c
               JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = s.id
               WHERE c.active = TRUE) AS cohort_ids
  FROM active_sims s
),
-- profile ∩ simulation ∩ active cohort (for true cohort-mode semantics)
profile_cohorts_for_sim AS (
  SELECT sa.id AS attempt_id, ap.profile_id, sa.simulation_id,
         ARRAY(
           SELECT c.id
           FROM cohorts c
           JOIN cohort_simulations cs ON cs.cohort_id = c.id AND cs.simulation_id = sa.simulation_id
           JOIN cohort_profiles cp ON cp.cohort_id = c.id AND cp.profile_id = ap.profile_id
           WHERE c.active = TRUE
         ) AS profile_cohort_ids
  FROM simulation_attempts sa
  LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
),
-- Pick one attempt per chat to avoid duplicate chat_id rows
-- Prefer attempts with active profiles, then most recent
chat_first_attempt AS (
  SELECT DISTINCT ON (ac.chat_id)
    ac.chat_id,
    ac.attempt_id
  FROM attempt_chats ac
  JOIN simulation_attempts sa ON sa.id = ac.attempt_id
  LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
  ORDER BY ac.chat_id, 
    CASE WHEN ap.profile_id IS NOT NULL THEN 0 ELSE 1 END, -- prefer attempts with active profiles
    sa.created_at DESC -- then most recent
),
-- Message counts per chat (total + by type)
message_counts AS (
  SELECT
    rc.chat_id,
    COUNT(*)::int                                AS num_messages_total,
    COUNT(*) FILTER (WHERE m.role = 'user')::int    AS num_query_messages,
    COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS num_response_messages
  FROM messages m
  JOIN runs r ON r.id = m.run_id
  JOIN chat_runs rc ON rc.run_id = r.id
  GROUP BY rc.chat_id
),
-- Per-message time deltas (seconds) computed in-order, then aggregated to int[]
-- Only measure persona "response → user query" gaps
message_deltas AS (
  SELECT
    rc.chat_id,
    -- only response -> query gaps
    CASE
      WHEN lag(m.role) OVER (PARTITION BY rc.chat_id ORDER BY m.created_at) = 'assistant'
       AND m.role = 'user'
      THEN GREATEST(
             EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at))
               OVER (PARTITION BY rc.chat_id ORDER BY m.created_at), c.created_at))::int, 0)
      ELSE NULL
    END AS delta_seconds,
    m.created_at
  FROM messages m
  JOIN runs r ON r.id = m.run_id
  JOIN chat_runs rc ON rc.run_id = r.id
  JOIN chats c ON c.id = rc.chat_id
),
message_deltas_agg AS (
  SELECT chat_id,
         ARRAY_REMOVE(array_agg(delta_seconds ORDER BY created_at), NULL) AS message_time_taken_seconds
  FROM message_deltas
  GROUP BY chat_id
),
effective_profile_department AS (
  -- Choose the primary department if set; otherwise earliest assignment
  SELECT pd.profile_id,
         COALESCE(
           (SELECT pd1.department_id
              FROM profile_departments pd1
             WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary
             LIMIT 1),
           (SELECT pd2.department_id
              FROM profile_departments pd2
             WHERE pd2.profile_id = pd.profile_id
             ORDER BY pd2.created_at ASC
             LIMIT 1)
         ) AS department_id
  FROM (SELECT DISTINCT ap.profile_id FROM simulation_attempts sa
        JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE) pd
),
-- Get first department_id for each entity from junction tables
simulation_first_dept AS (
    SELECT DISTINCT ON (simulation_id) 
        simulation_id, 
        department_id
    FROM simulation_departments
    WHERE active = true
    ORDER BY simulation_id, created_at
),
rubric_first_dept AS (
    SELECT DISTINCT ON (rubric_id) 
        rubric_id, 
        department_id
    FROM rubric_departments
    WHERE active = true
    ORDER BY rubric_id, created_at
),
scenario_first_dept AS (
    SELECT DISTINCT ON (scenario_id) 
        scenario_id, 
        department_id
    FROM scenario_departments
    WHERE active = true
    ORDER BY scenario_id, created_at
),
persona_first_dept AS (
    SELECT DISTINCT ON (persona_id) 
        persona_id, 
        department_id
    FROM persona_departments
    WHERE active = true
    ORDER BY persona_id, created_at
),
-- Pick one persona per scenario to avoid duplicate chat_id rows
-- Note: There should only be one active persona per scenario due to unique constraint,
-- but this ensures we only get one row even if data issues exist
scenario_first_persona AS (
    SELECT DISTINCT ON (scenario_id)
        scenario_id,
        persona_id
    FROM scenario_personas
    WHERE active = TRUE
    ORDER BY scenario_id, persona_id
)
SELECT
  -- *** original columns kept in the same order as your "Old def" ***
  sc.id                         AS chat_id,
  sa.id                         AS attempt_id,
  ap.profile_id                 AS profile_id,
  sa.simulation_id              AS simulation_id,

  rm.root_scenario_id           AS scenario_id,
  rm.leaf_scenario_id           AS leaf_scenario_id,

  sfp.persona_id                AS persona_id,
  p.color                       AS persona_color,

  sim.practice_simulation       AS is_practice,
  sa.archived                   AS is_archived,
  (NOT sim.practice_simulation AND NOT sa.archived) AS is_general,
  pr.role                       AS profile_role,
  cbs.cohort_ids                AS cohort_ids,
  sc.created_at                 AS chat_created_at,
  -- chat_completed_at removed (use grade_created_at or time_taken_seconds as source of truth)

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

  (sc.completed OR lg.simulation_chat_id IS NOT NULL)
                               AS completed,

  COALESCE(mc.num_messages_total, 0)            AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)            AS num_query_messages,
  COALESCE(mc.num_response_messages, 0)         AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}') AS message_time_taken_seconds,

  -- *** new trailing columns (safe append) ***
  sa.created_at                 AS attempt_created_at, -- use for date filters like TS did
  pcs.profile_cohort_ids        AS profile_cohort_ids, -- cohortIds "true membership"
  (SELECT COUNT(*) FROM simulation_scenarios ss WHERE ss.simulation_id = sim.id)::int AS sim_scenario_count, -- simulation's expected scenario count
  lg.created_at                 AS grade_created_at, -- grade creation time for stagnation metric
  
  -- Department ID coalesced from all relevant tables (using junction tables)
  COALESCE(
    epd.department_id,
    sfd.department_id,
    rfd.department_id,
    scfd.department_id,
    pfd.department_id
  ) AS department_id
FROM chats sc
JOIN chat_first_attempt cfa ON cfa.chat_id = sc.id
JOIN simulation_attempts sa ON sa.id = cfa.attempt_id
LEFT JOIN attempt_profiles ap ON ap.attempt_id = sa.id AND ap.active = TRUE
JOIN active_sims sim          ON sim.id = sa.simulation_id       -- enforce active simulation
JOIN profiles pr              ON pr.id = ap.profile_id
JOIN active_scenarios s       ON s.id = sc.scenario_id           -- enforce active scenario
JOIN root_map rm              ON rm.leaf_scenario_id = s.id
LEFT JOIN scenario_first_persona sfp ON sfp.scenario_id = s.id
LEFT JOIN personas p          ON p.id = sfp.persona_id
LEFT JOIN latest_grade lg     ON lg.simulation_chat_id = sc.id
LEFT JOIN rubrics r           ON r.id = lg.rubric_id
LEFT JOIN cohorts_by_sim cbs  ON cbs.simulation_id = sa.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc   ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
LEFT JOIN effective_profile_department epd ON epd.profile_id = ap.profile_id
LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id
LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.id
LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id
LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id
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
-- Latest grade per chat fast path (via chat_runs join)
CREATE INDEX IF NOT EXISTS grades_run_created_idx
  ON grades (run_id, eval, created_at DESC);

-- Feedback lookup by grade
CREATE INDEX IF NOT EXISTS feedbacks_grade_idx
  ON feedbacks (grade_id);

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
-- Latest grade per (run, rubric) fast path
CREATE INDEX IF NOT EXISTS grades_run_rubric_created_idx
  ON grades (run_id, rubric_id, eval, created_at DESC);

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
CREATE INDEX IF NOT EXISTS grades_run_created_idx
  ON grades (run_id, eval, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_run_created_role_idx
  ON messages (run_id, created_at, role);

CREATE INDEX IF NOT EXISTS chats_id_created_idx
  ON chats (id, created_at);

CREATE INDEX IF NOT EXISTS chat_runs_chat_id_idx
  ON chat_runs (chat_id);

CREATE INDEX IF NOT EXISTS chat_runs_run_id_idx
  ON chat_runs (run_id);

CREATE INDEX IF NOT EXISTS simulation_attempts_archived_idx
  ON simulation_attempts (archived);

-- Additional Performance Indexes for Analytics Functions
-- On the materialized view "analytics"
CREATE INDEX IF NOT EXISTS analytics_attempt_created_at_idx
  ON analytics (attempt_created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_profile_role_idx
  ON analytics (profile_role);

CREATE INDEX IF NOT EXISTS analytics_profile_id_idx
  ON analytics (profile_id);

CREATE INDEX IF NOT EXISTS analytics_is_practice_is_archived_is_general_idx
  ON analytics (is_practice, is_archived, is_general);

-- ARRAY overlap checks: cohort_ids && p_cohort_ids, profile_cohort_ids && p_cohort_ids
CREATE INDEX IF NOT EXISTS analytics_cohort_ids_gin
  ON analytics USING GIN (cohort_ids);

CREATE INDEX IF NOT EXISTS analytics_profile_cohort_ids_gin
  ON analytics USING GIN (profile_cohort_ids);

-- Common joins
CREATE INDEX IF NOT EXISTS simulations_id_active_idx
  ON simulations (id, active);

CREATE INDEX IF NOT EXISTS rubrics_id_idx ON rubrics (id);
CREATE INDEX IF NOT EXISTS scenarios_id_active_idx ON scenarios (id, active);
CREATE INDEX IF NOT EXISTS personas_id_idx ON personas (id);

-- Junction table indexes for analytics performance
CREATE INDEX IF NOT EXISTS attempt_profiles_attempt_active_idx
  ON attempt_profiles (attempt_id, profile_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS attempt_profiles_profile_active_idx
  ON attempt_profiles (profile_id, attempt_id) WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS scenario_personas_scenario_active_idx
  ON scenario_personas (scenario_id, persona_id) WHERE active = TRUE;

-- Optimized indexes for analytics functions performance
-- Profile + time range lookups for fast filtering
CREATE INDEX IF NOT EXISTS analytics_profile_time_idx
  ON analytics (profile_id, attempt_created_at DESC);

-- Partial indexes for hot-path queries (general/practice splits)
CREATE INDEX IF NOT EXISTS analytics_general_unarch_idx
  ON analytics (attempt_created_at, profile_id)
  WHERE is_general = TRUE AND is_archived = FALSE;

CREATE INDEX IF NOT EXISTS analytics_practice_unarch_idx
  ON analytics (attempt_created_at, profile_id)
  WHERE is_practice = TRUE AND is_archived = FALSE;

-- Rubric heatmap optimization indexes
-- (grades_run_created_idx already created above)

-- Feedback lookup by grade
CREATE INDEX IF NOT EXISTS feedbacks_grade_idx
  ON feedbacks (grade_id);

-- Standards mapping
CREATE INDEX IF NOT EXISTS standards_group_idx
  ON standards (standard_group_id);

-- Group ↔ rubric
CREATE INDEX IF NOT EXISTS standard_groups_rubric_idx
  ON standard_groups (rubric_id);

-- Department ID index for filtering by department
CREATE INDEX IF NOT EXISTS analytics_department_id_idx
  ON analytics (department_id);

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