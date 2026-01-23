-- Create Analytics Materialized View - Complete Definition
-- This SQL file creates the analytics materialized view with all necessary indexes.
-- Follows idempotent drop/recreate pattern - safe to run multiple times.
--
-- This view aggregates simulation attempts, chats_entry, grades_entry, and related data
-- for efficient analytics queries.
--
-- Uses junction tables for artifact-entry relationships:
--   scenario_tree_junction, simulation_attempts_junction, profile_attempts_junction,
--   scenario_chats_junction, messages_entry.chat_id
-- ============================================================================
-- Step 1: Drop all indexes on analytics materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all indexes on the analytics materialized view
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'analytics'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop analytics materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS analytics CASCADE;

-- ============================================================================
-- Step 3: Create Analytics Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW analytics AS
WITH RECURSIVE scenario_roots AS (
  -- Map every scenario.id to its root_id using scenario_tree_junction (self-edge = root)
  SELECT s.id, st.parent_id, s.id AS root_id
  FROM scenario_artifact s
  JOIN scenario_tree_junction st ON st.child_id = s.id AND st.parent_id = s.id -- self-edge = root
  UNION ALL
  SELECT s1.id, st.parent_id, sr.root_id
  FROM scenario_artifact s1
  JOIN scenario_tree_junction st ON st.child_id = s1.id AND st.parent_id <> s1.id
  JOIN scenario_roots sr ON st.parent_id = sr.id
),
root_map AS (
  SELECT s.id AS leaf_scenario_id,
         COALESCE(sr.root_id, s.id) AS root_scenario_id
  FROM scenario_artifact s
  LEFT JOIN scenario_roots sr ON s.id = sr.id
),
latest_grade AS (
  SELECT DISTINCT ON (c.id)
         c.id AS simulation_chat_id,
         g.score::numeric AS score,
         COALESCE(g.time_taken, 0)::numeric AS time_taken_seconds,
         srr.rubric_id,
         g.created_at
  FROM grades_entry g
  JOIN chats_entry c ON c.id = g.chat_id
  LEFT JOIN scenario_chats_junction scj ON scj.chat_id = c.id
  LEFT JOIN scenario_rubrics_resource srr ON srr.scenario_id = scj.scenario_id
  ORDER BY c.id, g.created_at DESC
),
-- only ACTIVE simulations
active_sims AS (
  SELECT s.* FROM simulation_artifact s
  WHERE EXISTS (
    SELECT 1 FROM simulation_flags_junction sf
    JOIN flags_resource f ON sf.flag_id = f.id
    WHERE sf.simulation_id = s.id
      AND f.name = 'simulation_active'
      AND sf.value = TRUE
  )
),
-- only ACTIVE scenarios
active_scenarios AS (
  SELECT s.* FROM scenario_artifact s
  WHERE EXISTS (
    SELECT 1 FROM scenario_flags_junction sf JOIN flags_resource f ON sf.flag_id = f.id
    WHERE sf.scenario_id = s.id
      AND f.name = 'scenario_active'
      AND sf.value = TRUE
  )
),
-- expand cohorts; we'll filter active where needed
cohorts_expanded AS (
  SELECT c.id,
    EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id
        AND f.name = 'cohort_active' AND cf.value = TRUE) AS active
  FROM cohort_artifact c
),
-- sims -> active cohorts using junction table
cohorts_by_sim AS (
  SELECT s.id AS simulation_id,
         ARRAY(SELECT DISTINCT c.id FROM cohort_artifact c
               JOIN cohort_simulations_junction cs ON cs.cohort_id = c.id AND cs.simulation_id = s.id
               WHERE EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id
                   AND f.name = 'cohort_active' AND cf.value = TRUE)) AS cohort_ids
  FROM active_sims s
),
-- profile ∩ simulation ∩ active cohort (for true cohort-mode semantics)
profile_cohorts_for_sim AS (
  SELECT sa.id AS attempt_id, paj.profile_id, saj.simulation_id,
         ARRAY(
           SELECT c.id
           FROM cohort_artifact c
           JOIN cohort_simulations_junction cs ON cs.cohort_id = c.id AND cs.simulation_id = saj.simulation_id
           JOIN profile_cohorts_junction cp ON cp.cohort_id = c.id AND cp.profile_id = paj.profile_id
           WHERE EXISTS (SELECT 1 FROM cohort_flags_junction cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id
               AND f.name = 'cohort_active' AND cf.value = TRUE)
         ) AS profile_cohort_ids
  FROM attempts_entry sa
  JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
  LEFT JOIN profile_attempts_junction paj ON paj.attempt_id = sa.id
),
-- Pick one attempt per chat to avoid duplicate chat_id rows
-- Prefer attempts with active profiles, then most recent
chat_first_attempt AS (
  SELECT DISTINCT ON (c.id)
    c.id AS chat_id,
    c.attempt_id
  FROM chats_entry c
  JOIN attempts_entry sa ON sa.id = c.attempt_id
  LEFT JOIN profile_attempts_junction paj ON paj.attempt_id = sa.id
  WHERE c.attempt_id IS NOT NULL
  ORDER BY c.id,
    CASE WHEN paj.profile_id IS NOT NULL THEN 0 ELSE 1 END, -- prefer attempts with active profiles
    sa.created_at DESC -- then most recent
),
-- Message counts per chat (using messages_entry.chat_id directly)
message_counts AS (
  SELECT
    m.chat_id,
    COUNT(*)::int                                AS num_messages_total,
    COUNT(*) FILTER (WHERE m.role = 'user')::int    AS num_query_messages,
    COUNT(*) FILTER (WHERE m.role = 'assistant')::int AS num_response_messages
  FROM messages_entry m
  WHERE m.chat_id IS NOT NULL
  GROUP BY m.chat_id
),
-- Per-message time deltas (seconds) computed in-order, then aggregated to int[]
-- Only measure persona "response → user query" gaps
message_deltas AS (
  SELECT
    m.chat_id,
    -- only response -> query gaps
    CASE
      WHEN lag(m.role) OVER (PARTITION BY m.chat_id ORDER BY m.created_at) = 'assistant'
       AND m.role = 'user'
      THEN GREATEST(
             EXTRACT(epoch FROM m.created_at - COALESCE(lag(COALESCE(m.updated_at, m.created_at))
               OVER (PARTITION BY m.chat_id ORDER BY m.created_at), c.created_at))::int, 0)
      ELSE NULL
    END AS delta_seconds,
    m.created_at
  FROM messages_entry m
  JOIN chats_entry c ON c.id = m.chat_id
  WHERE m.chat_id IS NOT NULL
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
              FROM profile_departments_junction pd1
             WHERE pd1.profile_id = pd.profile_id AND pd1.is_primary
             LIMIT 1),
           (SELECT pd2.department_id
              FROM profile_departments_junction pd2
             WHERE pd2.profile_id = pd.profile_id
             ORDER BY pd2.created_at ASC
             LIMIT 1)
         ) AS department_id
  FROM (SELECT DISTINCT paj.profile_id FROM profile_attempts_junction paj) pd
),
-- Get first department_id for each entity from junction tables
simulation_first_dept AS (
    SELECT DISTINCT ON (simulation_id)
        simulation_id,
        department_id
    FROM simulation_departments_junction
    WHERE active = true
    ORDER BY simulation_id, created_at
),
rubric_first_dept AS (
    SELECT DISTINCT ON (rubric_id)
        rubric_id,
        department_id
    FROM rubric_departments_junction
    WHERE active = true
    ORDER BY rubric_id, created_at
),
scenario_first_dept AS (
    SELECT DISTINCT ON (scenario_id)
        scenario_id,
        department_id
    FROM scenario_departments_junction
    WHERE active = true
    ORDER BY scenario_id, created_at
),
persona_first_dept AS (
    SELECT DISTINCT ON (persona_id)
        persona_id,
        department_id
    FROM persona_departments_junction
    WHERE active = true
    ORDER BY persona_id, created_at
),
-- Pick one persona per scenario to avoid duplicate chat_id rows
scenario_first_persona AS (
    SELECT DISTINCT ON (scenario_id)
        scenario_id,
        persona_id
    FROM scenario_personas_junction
    WHERE active = TRUE
    ORDER BY scenario_id, persona_id
)
SELECT
  sc.id                         AS chat_id,
  sa.id                         AS attempt_id,
  paj.profile_id                AS profile_id,
  saj.simulation_id             AS simulation_id,

  rm.root_scenario_id           AS scenario_id,
  rm.leaf_scenario_id           AS leaf_scenario_id,

  sfp.persona_id                AS persona_id,
  (SELECT c.hex_code FROM persona_colors_junction pc JOIN colors_resource c ON pc.color_id = c.id WHERE pc.persona_id = p.persona_id LIMIT 1) AS persona_color,

  EXISTS (
    SELECT 1 FROM simulation_flags_junction sf
    JOIN flags_resource f ON sf.flag_id = f.id
    WHERE sf.simulation_id = sim.id
      AND f.name = 'practice'
      AND sf.value = TRUE
  ) AS is_practice,
  COALESCE(sa.archived, FALSE)  AS is_archived,
  (NOT EXISTS (
    SELECT 1 FROM simulation_flags_junction sf
    JOIN flags_resource f ON sf.flag_id = f.id
    WHERE sf.simulation_id = sim.id
      AND f.name = 'practice'
      AND sf.value = TRUE
  ) AND NOT COALESCE(sa.archived, FALSE)) AS is_general,
  COALESCE(
    (SELECT r.role FROM profile_roles_junction pr_j
     JOIN roles_resource r ON pr_j.role_id = r.id
     WHERE pr_j.profile_id = pr.id
     LIMIT 1),
    'member'::profile_type
  ) AS profile_type,
  cbs.cohort_ids                AS cohort_ids,
  sc.created_at                 AS chat_created_at,

  lg.time_taken_seconds         AS time_taken_seconds,

  lg.rubric_id                  AS rubric_id,
  (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'total'::point_type LIMIT 1) AS rubric_points_junction,
  (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'pass'::point_type LIMIT 1) AS rubric_pass_points,
  CASE
    WHEN lg.score IS NULL OR (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'total'::point_type LIMIT 1) IS NULL
         OR (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'total'::point_type LIMIT 1) = 0 THEN NULL
    ELSE TRUNC((lg.score / (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'total'::point_type LIMIT 1)::numeric) * 100.0, 2)
  END                           AS grade_percent,
  CASE
    WHEN lg.score IS NULL
         OR (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'total'::point_type LIMIT 1) IS NULL
         OR (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'pass'::point_type LIMIT 1) IS NULL THEN NULL
    ELSE (lg.score >= (SELECT p.value FROM rubric_points_junction rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.rubric_id AND rp.type = 'pass'::point_type LIMIT 1)::numeric)
  END                           AS passed,

  (sc.completed OR lg.simulation_chat_id IS NOT NULL)
                               AS completed,

  COALESCE(mc.num_messages_total, 0)            AS num_messages_total,
  COALESCE(mc.num_query_messages, 0)            AS num_query_messages,
  COALESCE(mc.num_response_messages, 0)         AS num_response_messages,
  COALESCE(mda.message_time_taken_seconds, '{}') AS message_time_taken_seconds,

  sa.created_at                 AS attempt_created_at,
  pcs.profile_cohort_ids        AS profile_cohort_ids,
  (SELECT COUNT(*) FROM simulation_scenarios_junction ss WHERE ss.simulation_id = sim.id)::int AS sim_scenario_count,
  lg.created_at                 AS grade_created_at,

  -- Department ID coalesced from all relevant tables (using junction tables)
  COALESCE(
    epd.department_id,
    sfd.department_id,
    rfd.department_id,
    scfd.department_id,
    pfd.department_id
  ) AS department_id
FROM chats_entry sc
JOIN chat_first_attempt cfa ON cfa.chat_id = sc.id
JOIN attempts_entry sa ON sa.id = cfa.attempt_id
JOIN simulation_attempts_junction saj ON saj.attempt_id = sa.id
JOIN active_sims sim ON sim.id = saj.simulation_id
LEFT JOIN profile_attempts_junction paj ON paj.attempt_id = sa.id
LEFT JOIN profile_artifact pr ON pr.id = paj.profile_id
JOIN scenario_chats_junction scj ON scj.chat_id = sc.id
JOIN active_scenarios s ON s.id = scj.scenario_id
JOIN root_map rm ON rm.leaf_scenario_id = s.id
LEFT JOIN scenario_first_persona sfp ON sfp.scenario_id = s.id
LEFT JOIN personas_resource p ON p.id = sfp.persona_id
LEFT JOIN latest_grade lg ON lg.simulation_chat_id = sc.id
LEFT JOIN scenario_rubrics_resource srr_fallback ON srr_fallback.scenario_id = s.id AND lg.rubric_id IS NULL
LEFT JOIN rubrics_resource r ON r.rubric_id = COALESCE(lg.rubric_id, srr_fallback.rubric_id)
LEFT JOIN cohorts_by_sim cbs ON cbs.simulation_id = saj.simulation_id
LEFT JOIN profile_cohorts_for_sim pcs ON pcs.attempt_id = sa.id
LEFT JOIN message_counts mc ON mc.chat_id = sc.id
LEFT JOIN message_deltas_agg mda ON mda.chat_id = sc.id
LEFT JOIN effective_profile_department epd ON epd.profile_id = paj.profile_id
LEFT JOIN simulation_first_dept sfd ON sfd.simulation_id = sim.id
LEFT JOIN rubric_first_dept rfd ON rfd.rubric_id = r.rubric_id
LEFT JOIN scenario_first_dept scfd ON scfd.scenario_id = s.id
LEFT JOIN persona_first_dept pfd ON pfd.persona_id = p.id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX analytics_pk
  ON analytics (chat_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX analytics_simulation_id_idx
  ON analytics (simulation_id);

CREATE INDEX analytics_profile_id_idx
  ON analytics (profile_id);

CREATE INDEX analytics_scenario_id_idx
  ON analytics (scenario_id);

CREATE INDEX analytics_leaf_scenario_id_idx
  ON analytics (leaf_scenario_id);

CREATE INDEX analytics_chat_created_at_idx
  ON analytics (chat_created_at);

CREATE INDEX analytics_is_practice_idx
  ON analytics (is_practice);

CREATE INDEX analytics_is_archived_idx
  ON analytics (is_archived);

CREATE INDEX analytics_is_general_idx
  ON analytics (is_general);

CREATE INDEX analytics_profile_type_idx
  ON analytics (profile_type);

-- GIN for array membership filtering on cohort_ids
CREATE INDEX analytics_cohort_ids_gin
  ON analytics USING GIN (cohort_ids);

-- Optional: fast pass-rate and time-range scans
CREATE INDEX analytics_passed_idx
  ON analytics (passed);

CREATE INDEX analytics_time_taken_idx
  ON analytics (time_taken_seconds);

-- New: for cohort-mode membership & attempt-date filters
CREATE INDEX analytics_profile_cohort_ids_gin
  ON analytics USING GIN (profile_cohort_ids);

CREATE INDEX analytics_attempt_created_at_idx
  ON analytics (attempt_created_at);

-- ============================================================================
-- Step 6: Create Performance Indexes for Analytics Functions
-- ============================================================================

-- Latest grade per chat fast path
CREATE INDEX IF NOT EXISTS grades_run_created_idx
  ON grades_entry (run_id, created_at DESC);

-- Standards mapping
CREATE INDEX IF NOT EXISTS standards_group_idx
  ON standards_resource (standard_group_id);

-- Group ↔ rubric (via junction table)
CREATE INDEX IF NOT EXISTS rubric_standard_groups_rubric_idx
  ON rubric_standard_groups_junction (rubric_id);
CREATE INDEX IF NOT EXISTS rubric_standard_groups_standard_group_idx
  ON rubric_standard_groups_junction (standard_group_id);

-- Analytics 'where' clause helpers
CREATE INDEX analytics_chat_created_idx
  ON analytics (chat_created_at);

CREATE INDEX analytics_chat_id_idx
  ON analytics (chat_id);

-- Additional analytics filtering indexes
CREATE INDEX analytics_simulation_idx
  ON analytics (simulation_id);

-- Group id + rubric (via junction table)
CREATE INDEX IF NOT EXISTS rubric_standard_groups_rubric_standard_group_idx
  ON rubric_standard_groups_junction (rubric_id, standard_group_id);

-- Performance optimization indexes for analytics functions
CREATE INDEX analytics_role_time_idx
  ON analytics (profile_type, attempt_created_at);

-- Partial indexes for common filter patterns
CREATE INDEX analytics_is_general_true_idx
  ON analytics (attempt_created_at) WHERE is_general = true;

CREATE INDEX analytics_is_practice_true_idx
  ON analytics (attempt_created_at) WHERE is_practice = true;

CREATE INDEX analytics_is_archived_true_idx
  ON analytics (attempt_created_at) WHERE is_archived = true;

-- Index for messages_entry.chat_id
CREATE INDEX IF NOT EXISTS messages_chat_id_created_idx
  ON messages_entry (chat_id, created_at);

CREATE INDEX IF NOT EXISTS chats_id_created_idx
  ON chats_entry (id, created_at);

CREATE INDEX IF NOT EXISTS attempts_entry_archived_idx
  ON attempts_entry (archived);

-- Common joins
CREATE INDEX IF NOT EXISTS simulations_id_idx
  ON simulations_resource (id);

CREATE INDEX IF NOT EXISTS rubrics_id_idx ON rubrics_resource (id);
CREATE INDEX IF NOT EXISTS scenarios_id_idx ON scenarios_resource (id);
CREATE INDEX IF NOT EXISTS personas_id_idx ON personas_resource (id);

-- Junction table indexes for analytics performance
CREATE INDEX IF NOT EXISTS scenario_personas_scenario_active_idx
  ON scenario_personas_junction (scenario_id, persona_id) WHERE active = TRUE;

-- Index for scenario_rubrics_resource lookup
CREATE INDEX IF NOT EXISTS scenario_rubrics_resource_scenario_id_idx
  ON scenario_rubrics_resource (scenario_id);

-- Profile + time range lookups for fast filtering
CREATE INDEX analytics_profile_time_idx
  ON analytics (profile_id, attempt_created_at DESC);

-- Partial indexes for hot-path queries (general/practice splits)
CREATE INDEX analytics_general_unarch_idx
  ON analytics (attempt_created_at, profile_id)
  WHERE is_general = TRUE AND is_archived = FALSE;

CREATE INDEX analytics_practice_unarch_idx
  ON analytics (attempt_created_at, profile_id)
  WHERE is_practice = TRUE AND is_archived = FALSE;

-- Department ID index for filtering by department
CREATE INDEX analytics_department_id_idx
  ON analytics (department_id);

-- Combined practice/archived/general index
CREATE INDEX analytics_is_practice_is_archived_is_general_idx
  ON analytics (is_practice, is_archived, is_general);

-- ============================================================================
-- Step 7: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW analytics;
