-- Materialized View: mv_simulation_attempts
-- Attempt-level data for simulation attempt detail views.
--
-- Grain: One row per attempt
-- Filter: archived = FALSE only (practice is a column, not a filter)
--
-- Purpose: Provides attempt-level aggregates for parallel fetching
-- Section: SIMULATION (unified view - both home and practice)
--
-- Dependencies: Only uses _entry and _connection tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_simulation_attempts materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_simulation_attempts'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_simulation_attempts materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_simulation_attempts CASCADE;

-- ============================================================================
-- Step 3: Create mv_simulation_attempts Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_simulation_attempts AS
-- Simple attempt-level data only
-- All aggregates (total_chats, scores, etc.) derived in service layer from chats
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
    COALESCE(a.infinite_mode, FALSE) AS infinite_mode

FROM simulation_attempts_entry a
-- Attempt connections (required)
JOIN simulation_attempts_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN simulation_attempts_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN simulation_attempts_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN simulation_attempts_cohorts_connection acc ON acc.attempt_id = a.id
WHERE a.active = TRUE
  AND COALESCE(a.archived, FALSE) = FALSE  -- not archived
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_simulation_attempts_pk
    ON mv_simulation_attempts (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX mv_simulation_attempts_practice_idx
    ON mv_simulation_attempts (practice);

-- Profile ID for permission checks and filtering
CREATE INDEX mv_simulation_attempts_profile_id_idx
    ON mv_simulation_attempts (profile_id);

-- Simulation ID for filtering
CREATE INDEX mv_simulation_attempts_simulation_id_idx
    ON mv_simulation_attempts (simulation_id);

-- Cohort ID for filtering
CREATE INDEX mv_simulation_attempts_cohort_id_idx
    ON mv_simulation_attempts (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department ID for filtering
CREATE INDEX mv_simulation_attempts_department_id_idx
    ON mv_simulation_attempts (department_id)
    WHERE department_id IS NOT NULL;

-- Timestamp for sorting
CREATE INDEX mv_simulation_attempts_created_at_idx
    ON mv_simulation_attempts (attempt_created_at DESC);

-- Composite: profile + simulation
CREATE INDEX mv_simulation_attempts_profile_simulation_idx
    ON mv_simulation_attempts (profile_id, simulation_id);

-- Composite: practice + profile (common filter pattern)
CREATE INDEX mv_simulation_attempts_practice_profile_idx
    ON mv_simulation_attempts (practice, profile_id);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_simulation_attempts;
