-- Materialized View: mv_attempt_list
-- Attempt-level data for attempt detail views.
--
-- Grain: One row per attempt
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides attempt-level aggregates for parallel fetching
-- Section: ATTEMPT (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_attempt_list materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_list'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_attempt_list materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_list CASCADE;

-- ============================================================================
-- Step 3: Create mv_attempt_list Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_attempt_list AS
-- Simple attempt-level data only
-- All aggregates (total_chats, scores, etc.) derived in service layer from chats
WITH
-- Collect scenario_ids per attempt from chats → training_bundle_departments
attempt_scenarios AS (
    SELECT
        c.attempt_id,
        COALESCE(
            ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id)
            FILTER (WHERE tsc.scenarios_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS scenario_ids
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a2 ON a2.id = c.attempt_id AND a2.active = TRUE
    LEFT JOIN training_bundle_departments_entry tbd
        ON tbd.id = c.training_bundle_department_id AND tbd.active = TRUE
    LEFT JOIN training_bundle_departments_scenarios_connection tsc
        ON tsc.training_bundle_department_id = tbd.id AND tsc.active = TRUE
    WHERE c.active = TRUE
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

    -- Practice flag (exposed as column for filtering)
    COALESCE(a.practice, FALSE) AS practice,

    -- Attempt timestamps and flags
    a.created_at AS attempt_created_at,
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode,

    -- Archived flag (for filtering archived attempts)
    COALESCE(a.archived, FALSE) AS is_archived,

    -- Scenario IDs (for filtering and display)
    COALESCE(ascn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids

FROM simulation_attempts_entry a
-- Attempt connections (required)
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
-- Scenario IDs (optional)
LEFT JOIN attempt_scenarios ascn ON ascn.attempt_id = a.id
WHERE a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_attempt_list_pk
    ON mv_attempt_list (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_attempt_list_practice_idx
    ON mv_attempt_list (practice);

-- Profile ID for permission checks and filtering
CREATE INDEX mv_attempt_list_profile_id_idx
    ON mv_attempt_list (profile_id);

-- Simulation ID for filtering
CREATE INDEX mv_attempt_list_simulation_id_idx
    ON mv_attempt_list (simulation_id);

-- Cohort ID for filtering
CREATE INDEX mv_attempt_list_cohort_id_idx
    ON mv_attempt_list (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department ID for filtering
CREATE INDEX mv_attempt_list_department_id_idx
    ON mv_attempt_list (department_id)
    WHERE department_id IS NOT NULL;

-- Timestamp for sorting
CREATE INDEX mv_attempt_list_created_at_idx
    ON mv_attempt_list (attempt_created_at DESC);

-- Composite: profile + simulation
CREATE INDEX mv_attempt_list_profile_simulation_idx
    ON mv_attempt_list (profile_id, simulation_id);

-- Composite: practice + profile (common filter pattern)
CREATE INDEX mv_attempt_list_practice_profile_idx
    ON mv_attempt_list (practice, profile_id);

-- Archived flag for filtering
CREATE INDEX mv_attempt_list_is_archived_idx
    ON mv_attempt_list (is_archived);

-- GIN index on scenario_ids for array overlap filtering
CREATE INDEX mv_attempt_list_scenario_ids_gin
    ON mv_attempt_list USING GIN (scenario_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_attempt_list;
