-- Materialized View: mv_simulation_overview
-- Simulation-level aggregation for overview/home cards.
--
-- Grain: One row per (simulation_id, profile_id, practice) combination
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides simulation cards with aggregated stats (attempt count, highest score, etc.)
-- Section: SIMULATION (unified view - both home and practice)
--
-- Source: Aggregates from base entry tables grouped by simulation
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_overview materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_overview'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_overview materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_overview CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_overview Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_overview AS
WITH
-- Latest grade per chat
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
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
        COALESCE(a.practice, FALSE) AS practice,
        COALESCE(c.completed, FALSE) AS completed,
        lg.score,
        lg.passed,
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
      AND COALESCE(a.archived, FALSE) = FALSE
),
-- Attempt-level aggregation (needed to compute attempt counts)
attempt_aggregates AS (
    SELECT
        attempt_id,
        simulation_id,
        profile_id,
        cohort_id,
        department_id,
        practice,
        BOOL_OR(completed) AS has_completed_chat,
        BOOL_OR(passed) AS has_passed,
        MAX(grade_percent) AS highest_score_percent,
        MAX(rubric_total_points)::int AS rubric_total_points,
        MAX(rubric_pass_points)::int AS rubric_pass_points,
        ARRAY_AGG(DISTINCT persona_id) FILTER (WHERE persona_id IS NOT NULL) AS persona_ids
    FROM chat_facts
    GROUP BY attempt_id, simulation_id, profile_id, cohort_id, department_id, practice
)
SELECT
    -- Composite key (simulation + profile + practice)
    simulation_id,
    profile_id,
    practice,

    -- Optional filters
    cohort_id,
    department_id,

    -- Attempt counts
    COUNT(*)::int AS attempt_count,
    COUNT(*) FILTER (WHERE has_completed_chat = TRUE)::int AS completed_count,
    COUNT(*) FILTER (WHERE has_passed = TRUE)::int AS passed_count,

    -- Score metrics
    MAX(highest_score_percent) AS highest_score_percent,
    BOOL_OR(has_passed) AS has_ever_passed,

    -- Rubric points (for computing pass_pct in Python)
    MAX(rubric_total_points)::int AS rubric_total_points,
    MAX(rubric_pass_points)::int AS rubric_pass_points,

    -- Arrays for display
    ARRAY_AGG(DISTINCT unnest_persona) FILTER (WHERE unnest_persona IS NOT NULL) AS persona_ids

FROM attempt_aggregates,
     LATERAL unnest(COALESCE(persona_ids, ARRAY[]::uuid[])) AS unnest_persona
GROUP BY simulation_id, profile_id, practice, cohort_id, department_id
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_overview_pk
    ON mv_simulation_overview (simulation_id, profile_id, practice, cohort_id, department_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_simulation_overview_practice_idx
    ON mv_simulation_overview (practice);

-- Profile ID for primary lookup
CREATE INDEX mv_simulation_overview_profile_id_idx
    ON mv_simulation_overview (profile_id);

-- Simulation ID for filtering
CREATE INDEX mv_simulation_overview_simulation_id_idx
    ON mv_simulation_overview (simulation_id);

-- Cohort ID for filtering
CREATE INDEX mv_simulation_overview_cohort_id_idx
    ON mv_simulation_overview (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department ID for filtering
CREATE INDEX mv_simulation_overview_department_id_idx
    ON mv_simulation_overview (department_id)
    WHERE department_id IS NOT NULL;

-- Composite: practice + profile (common filter pattern)
CREATE INDEX mv_simulation_overview_practice_profile_idx
    ON mv_simulation_overview (practice, profile_id);

-- Composite: profile + simulation
CREATE INDEX mv_simulation_overview_profile_simulation_idx
    ON mv_simulation_overview (profile_id, simulation_id);

-- Has passed for filtering
CREATE INDEX mv_simulation_overview_has_passed_idx
    ON mv_simulation_overview (has_ever_passed)
    WHERE has_ever_passed = TRUE;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_overview;
