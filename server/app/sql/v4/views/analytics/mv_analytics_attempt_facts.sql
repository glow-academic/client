-- Materialized View: mv_attempt_facts
-- Attempt-level aggregates for history tables and overview cards.
--
-- Grain: One row per attempt
-- Filter: None at MV level - all data included (filtering done at query time)
--
-- Purpose: Attempt-level aggregates for Home, Practice, Dashboard, and Reports history
-- Section: ANALYTICS (self-contained, no MV dependencies)
--
-- Dependencies: Uses entry tables only
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_facts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_facts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_facts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_facts CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_facts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_facts AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.total_points AS rubric_total_points,
        g.pass_points AS rubric_pass_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
chat_scope AS (
    SELECT
        c.id AS chat_id,
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at) FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
        COALESCE(ARRAY_AGG(DISTINCT tpc.personas_id ORDER BY tpc.personas_id) FILTER (WHERE tpc.personas_id IS NOT NULL), ARRAY[]::uuid[]) AS persona_ids
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN training_bundle_departments_entry tbd ON tbd.id = c.training_bundle_department_id AND tbd.active = TRUE
    LEFT JOIN training_bundle_departments_scenarios_connection tsc ON tsc.training_bundle_department_id = tbd.id AND tsc.active = TRUE
    LEFT JOIN training_bundle_departments_personas_connection tpc ON tpc.training_bundle_department_id = tbd.id AND tpc.active = TRUE
    WHERE c.active = TRUE
      AND a.active = TRUE
    GROUP BY c.id
),
chat_facts AS (
    SELECT
        c.id AS chat_id,
        c.attempt_id,
        asc_conn.simulations_id AS simulation_id,
        apc.profiles_id AS profile_id,
        acc.cohorts_id AS cohort_id,
        adc.departments_id AS department_id,
        a.created_at AS attempt_created_at,
        CASE WHEN COALESCE(a.practice, FALSE) THEN 'practice' ELSE 'general' END AS attempt_type,
        COALESCE(a.archived, FALSE) AS is_archived,
        COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
        (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS completed,
        cs.scenario_id,
        (cs.persona_ids)[1] AS persona_id,
        lg.passed,
        lg.time_taken,
        CASE
            WHEN lg.rubric_total_points IS NOT NULL AND lg.rubric_total_points > 0
            THEN ROUND((lg.score::numeric / lg.rubric_total_points::numeric) * 100, 2)
            ELSE NULL
        END AS grade_percent,
        lg.rubric_total_points,
        lg.rubric_pass_points
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
    LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
    LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
    JOIN chat_scope cs ON cs.chat_id = c.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    WHERE c.active = TRUE
      AND a.active = TRUE
)
SELECT
    -- Primary key
    cf.attempt_id,

    -- Resource IDs (from first chat in attempt - same across all chats)
    cf.profile_id,
    cf.simulation_id,
    cf.cohort_id,
    cf.department_id,

    -- Timestamps (from attempt)
    cf.attempt_created_at,

    -- Flags (from first/any chat in attempt - same across all chats)
    cf.attempt_type,
    cf.is_archived,
    cf.infinite_mode,

    -- Aggregated from chats
    COUNT(*)::int AS num_chats,
    COUNT(*) FILTER (WHERE cf.completed = TRUE)::int AS num_chats_completed,
    COUNT(DISTINCT cf.scenario_id)::int AS num_scenarios,
    COUNT(DISTINCT cf.scenario_id) FILTER (WHERE cf.completed = TRUE)::int AS num_scenarios_completed,

    -- Score aggregates
    ROUND(AVG(cf.grade_percent) FILTER (WHERE cf.grade_percent IS NOT NULL), 2) AS score_percent,
    BOOL_OR(cf.passed) AS has_passed,

    -- Time aggregates
    COALESCE(SUM(cf.time_taken) FILTER (WHERE cf.time_taken IS NOT NULL), 0)::int AS total_time_seconds,

    -- Rubric points (MAX - same across chats in attempt from same simulation)
    MAX(cf.rubric_total_points) AS rubric_total_points,
    MAX(cf.rubric_pass_points) AS rubric_pass_points,

    -- Arrays for display/filtering
    ARRAY_AGG(DISTINCT cf.scenario_id ORDER BY cf.scenario_id) AS scenario_ids,
    ARRAY_AGG(DISTINCT cf.persona_id ORDER BY cf.persona_id) FILTER (WHERE cf.persona_id IS NOT NULL) AS persona_ids

FROM chat_facts cf
GROUP BY
    cf.attempt_id,
    cf.profile_id,
    cf.simulation_id,
    cf.cohort_id,
    cf.department_id,
    cf.attempt_created_at,
    cf.attempt_type,
    cf.is_archived,
    cf.infinite_mode
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_facts_pk
    ON mv_attempt_facts (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Resource ID indexes
CREATE INDEX mv_attempt_facts_profile_id_idx
    ON mv_attempt_facts (profile_id);

CREATE INDEX mv_attempt_facts_simulation_id_idx
    ON mv_attempt_facts (simulation_id);

CREATE INDEX mv_attempt_facts_cohort_id_idx
    ON mv_attempt_facts (cohort_id)
    WHERE cohort_id IS NOT NULL;

CREATE INDEX mv_attempt_facts_department_id_idx
    ON mv_attempt_facts (department_id)
    WHERE department_id IS NOT NULL;

-- Time indexes
CREATE INDEX mv_attempt_facts_created_at_desc_idx
    ON mv_attempt_facts (attempt_created_at DESC);

-- Flag indexes
CREATE INDEX mv_attempt_facts_attempt_type_idx
    ON mv_attempt_facts (attempt_type);

CREATE INDEX mv_attempt_facts_is_archived_idx
    ON mv_attempt_facts (is_archived);

-- Composite indexes for common patterns

-- Home history: profile + type + archived + time
CREATE INDEX mv_attempt_facts_profile_type_archived_time_idx
    ON mv_attempt_facts (profile_id, attempt_type, is_archived, attempt_created_at DESC);

-- Practice history: profile + practice type + time
CREATE INDEX mv_attempt_facts_profile_practice_time_idx
    ON mv_attempt_facts (profile_id, attempt_created_at DESC)
    WHERE attempt_type = 'practice';

-- Dashboard history: cohort + time
CREATE INDEX mv_attempt_facts_cohort_time_idx
    ON mv_attempt_facts (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

-- Overview cards: profile + simulation
CREATE INDEX mv_attempt_facts_profile_simulation_idx
    ON mv_attempt_facts (profile_id, simulation_id);

-- Dashboard simulation chart: cohort + simulation
CREATE INDEX mv_attempt_facts_cohort_simulation_idx
    ON mv_attempt_facts (cohort_id, simulation_id)
    WHERE cohort_id IS NOT NULL;

-- Partial index for non-archived general (Home - most common)
CREATE INDEX mv_attempt_facts_home_default_idx
    ON mv_attempt_facts (profile_id, attempt_created_at DESC)
    WHERE attempt_type = 'general' AND is_archived = FALSE;

-- Partial index for non-archived (common query pattern)
CREATE INDEX mv_attempt_facts_not_archived_idx
    ON mv_attempt_facts (attempt_type, profile_id, attempt_created_at DESC)
    WHERE is_archived = FALSE;

-- GIN indexes on array columns for filtering
CREATE INDEX mv_attempt_facts_scenario_ids_gin_idx
    ON mv_attempt_facts USING GIN (scenario_ids);

CREATE INDEX mv_attempt_facts_persona_ids_gin_idx
    ON mv_attempt_facts USING GIN (persona_ids)
    WHERE persona_ids IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_facts;
