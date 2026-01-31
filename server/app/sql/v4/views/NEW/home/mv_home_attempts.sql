-- Materialized View: mv_home_attempts
-- Attempt-level data for HOME attempt detail endpoint.
--
-- Grain: One row per attempt
-- Filter: practice IS NOT TRUE AND archived = FALSE (general/home only)
--
-- Purpose: Provides attempt-level aggregates for parallel fetching
-- Section: HOME (attempt detail)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_home_attempts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_attempts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_attempts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_attempts CASCADE;

-- ============================================================================
-- Step 3: Create mv_home_attempts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_home_attempts AS
WITH
-- Pre-aggregate chat-level data per attempt
chat_aggregates AS (
    SELECT
        c.attempt_id,
        COUNT(*)::int AS total_chats,
        COUNT(*) FILTER (WHERE c.completed = TRUE)::int AS completed_chats,
        ARRAY_AGG(DISTINCT csc.scenarios_id) FILTER (WHERE csc.scenarios_id IS NOT NULL) AS scenario_ids,
        ARRAY_AGG(DISTINCT cpc.personas_id) FILTER (WHERE cpc.personas_id IS NOT NULL) AS persona_ids
    FROM simulation_chats_entry c
    JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
    LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
    WHERE c.active = TRUE
    GROUP BY c.attempt_id
),
-- Pre-aggregate grade data per attempt
grade_aggregates AS (
    SELECT
        c.attempt_id,
        SUM(g.score)::float AS total_score,
        BOOL_AND(g.passed) AS all_passed,
        SUM(COALESCE(g.time_taken, 0))::int AS elapsed_seconds,
        MAX(g.total_points)::int AS rubric_total_points,
        MAX(g.pass_points)::int AS rubric_pass_points
    FROM simulation_chats_entry c
    JOIN simulation_grades_entry g ON g.chat_id = c.id AND g.active = TRUE
    WHERE c.active = TRUE AND c.completed = TRUE
    GROUP BY c.attempt_id
)
SELECT
    -- Primary key
    a.id AS attempt_id,

    -- Resource IDs (from connections for _resource joins at runtime)
    asc_conn.simulations_id AS simulation_id,
    apc.profiles_id AS profile_id,
    acc.cohorts_id AS cohort_id,
    adc.departments_id AS department_id,

    -- Attempt timestamps and flags
    a.created_at AS attempt_created_at,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,

    -- Pre-aggregated from chats
    COALESCE(ca.total_chats, 0) AS total_chats,
    COALESCE(ca.completed_chats, 0) AS completed_chats,
    COALESCE(ga.total_score, 0) AS total_score,
    COALESCE(ga.all_passed, FALSE) AS all_passed,
    COALESCE(ga.elapsed_seconds, 0) AS elapsed_seconds,
    ga.rubric_total_points,
    ga.rubric_pass_points,

    -- Array IDs for display (join to _resource at query time)
    COALESCE(ca.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,
    COALESCE(ca.persona_ids, ARRAY[]::uuid[]) AS persona_ids

FROM simulation_attempts_entry a
-- Attempt connections (required)
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
-- Chat aggregates
LEFT JOIN chat_aggregates ca ON ca.attempt_id = a.id
-- Grade aggregates
LEFT JOIN grade_aggregates ga ON ga.attempt_id = a.id
WHERE a.active = TRUE
  AND a.practice IS NOT TRUE  -- general only
  AND COALESCE(a.archived, FALSE) = FALSE  -- not archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_home_attempts_pk
    ON mv_home_attempts (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile ID for permission checks and filtering
CREATE INDEX mv_home_attempts_profile_id_idx
    ON mv_home_attempts (profile_id);

-- Simulation ID for filtering
CREATE INDEX mv_home_attempts_simulation_id_idx
    ON mv_home_attempts (simulation_id);

-- Cohort ID for filtering
CREATE INDEX mv_home_attempts_cohort_id_idx
    ON mv_home_attempts (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department ID for filtering
CREATE INDEX mv_home_attempts_department_id_idx
    ON mv_home_attempts (department_id)
    WHERE department_id IS NOT NULL;

-- Timestamp for sorting
CREATE INDEX mv_home_attempts_created_at_idx
    ON mv_home_attempts (attempt_created_at DESC);

-- Composite: profile + simulation
CREATE INDEX mv_home_attempts_profile_simulation_idx
    ON mv_home_attempts (profile_id, simulation_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_home_attempts;
