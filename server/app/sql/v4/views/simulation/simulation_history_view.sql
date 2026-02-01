-- Materialized View: mv_simulation_history
-- Attempt-level aggregation for paginated history views.
--
-- Grain: One row per attempt
-- Filter: None (is_archived and practice are columns for filtering at query time)
--
-- Purpose: Provides paginated attempt history with date filtering support
-- Section: SIMULATION (unified view - both home and practice)
--
-- Source: Aggregates from base entry tables grouped by attempt
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_history materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_history'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_history materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_history CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_history Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_history AS
WITH
-- Latest grade per chat
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
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
-- Chat-level facts with grade data
chat_facts AS (
    SELECT
        c.id AS chat_id,
        a.id AS attempt_id,
        asc_conn.simulations_id AS simulation_id,
        apc.profiles_id AS profile_id,
        acc.cohorts_id AS cohort_id,
        adc.departments_id AS department_id,
        csc.scenarios_id AS scenario_id,
        cpc.personas_id AS persona_id,
        a.created_at AS attempt_created_at,
        COALESCE(a.practice, FALSE) AS practice,
        COALESCE(a.infinite_mode, FALSE) AS infinite_mode,
        COALESCE(a.archived, FALSE) AS is_archived,
        COALESCE(c.completed, FALSE) AS completed,
        lg.score,
        lg.passed,
        lg.time_taken,
        lg.rubric_total_points,
        lg.rubric_pass_points,
        CASE
            WHEN lg.score IS NULL OR lg.rubric_total_points IS NULL OR lg.rubric_total_points = 0 THEN NULL
            ELSE TRUNC((lg.score::numeric / lg.rubric_total_points) * 100.0, 2)
        END AS grade_percent
    FROM simulation_attempts_entry a
    JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
    JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
    LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
    LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
    JOIN simulation_chats_entry c ON c.attempt_id = a.id AND c.active = TRUE
    JOIN simulation_chats_scenarios_connection csc ON csc.chat_id = c.id
    LEFT JOIN simulation_chats_personas_connection cpc ON cpc.chat_id = c.id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    WHERE a.active = TRUE
)
SELECT
    -- Primary key
    attempt_id,

    -- Keys for filtering
    profile_id,
    simulation_id,
    cohort_id,
    department_id,

    -- Timestamps
    MIN(attempt_created_at) AS attempt_created_at,

    -- Flags
    practice,
    BOOL_OR(infinite_mode) AS infinite_mode,
    is_archived,

    -- Pre-aggregated from chats
    COUNT(*)::int AS num_chats,
    COUNT(*) FILTER (WHERE completed = TRUE)::int AS num_chats_completed,
    COUNT(DISTINCT scenario_id)::int AS num_scenarios,
    COUNT(DISTINCT scenario_id) FILTER (WHERE completed = TRUE)::int AS num_scenarios_completed,
    TRUNC(AVG(grade_percent), 2) AS score_percent,
    BOOL_OR(passed) AS has_passed,
    SUM(COALESCE(time_taken, 0))::int AS total_time_seconds,

    -- Rubric points (for computing pass_pct in Python)
    -- Takes MAX since all chats in an attempt share the same rubric
    MAX(rubric_total_points)::int AS rubric_total_points,
    MAX(rubric_pass_points)::int AS rubric_pass_points,

    -- Arrays for display (IDs only - join to _resource at query time)
    ARRAY_AGG(DISTINCT scenario_id) FILTER (WHERE scenario_id IS NOT NULL) AS scenario_ids,
    ARRAY_AGG(DISTINCT persona_id) FILTER (WHERE persona_id IS NOT NULL) AS persona_ids

FROM chat_facts
GROUP BY attempt_id, profile_id, simulation_id, cohort_id, department_id, practice, is_archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_history_pk
    ON mv_simulation_history (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_simulation_history_practice_idx
    ON mv_simulation_history (practice);

-- Primary lookup: profile's attempts
CREATE INDEX mv_simulation_history_profile_id_idx
    ON mv_simulation_history (profile_id);

-- Simulation filtering
CREATE INDEX mv_simulation_history_simulation_id_idx
    ON mv_simulation_history (simulation_id);

-- Cohort filtering
CREATE INDEX mv_simulation_history_cohort_id_idx
    ON mv_simulation_history (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department filtering
CREATE INDEX mv_simulation_history_department_id_idx
    ON mv_simulation_history (department_id)
    WHERE department_id IS NOT NULL;

-- Time-based sorting (most common for history pages)
CREATE INDEX mv_simulation_history_created_at_idx
    ON mv_simulation_history (attempt_created_at DESC);

-- Composite: profile + time for user history pagination
CREATE INDEX mv_simulation_history_profile_created_idx
    ON mv_simulation_history (profile_id, attempt_created_at DESC);

-- Composite: simulation + time for simulation history
CREATE INDEX mv_simulation_history_simulation_created_idx
    ON mv_simulation_history (simulation_id, attempt_created_at DESC);

-- Composite: cohort + time for cohort history
CREATE INDEX mv_simulation_history_cohort_created_idx
    ON mv_simulation_history (cohort_id, attempt_created_at DESC)
    WHERE cohort_id IS NOT NULL;

-- Composite: practice + profile + time (common filter pattern)
CREATE INDEX mv_simulation_history_practice_profile_created_idx
    ON mv_simulation_history (practice, profile_id, attempt_created_at DESC);

-- Pass status filtering
CREATE INDEX mv_simulation_history_has_passed_idx
    ON mv_simulation_history (has_passed)
    WHERE has_passed = TRUE;

-- Score-based sorting
CREATE INDEX mv_simulation_history_score_percent_idx
    ON mv_simulation_history (score_percent DESC NULLS LAST)
    WHERE score_percent IS NOT NULL;

-- Archived filtering (for practice mode)
CREATE INDEX mv_simulation_history_is_archived_idx
    ON mv_simulation_history (is_archived);

-- Composite: practice + archived (common filter pattern for practice mode)
CREATE INDEX mv_simulation_history_practice_archived_idx
    ON mv_simulation_history (practice, is_archived);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_history;
