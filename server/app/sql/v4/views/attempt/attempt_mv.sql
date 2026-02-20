-- Materialized View: attempt_mv
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
-- Step 1: Drop all indexes on attempt_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'attempt_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop attempt_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS attempt_mv CASCADE;

-- ============================================================================
-- Step 3: Create attempt_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW attempt_mv AS
-- Simple attempt-level data only
-- All aggregates (total_chats, scores, etc.) derived in service layer from chats
WITH
-- Collect scenario_ids per attempt from chats → chat_resolved scenarios
attempt_scenarios AS (
    SELECT
        ac.attempt_id,
        COALESCE(
            ARRAY_AGG(DISTINCT tsc.scenarios_id ORDER BY tsc.scenarios_id)
            FILTER (WHERE tsc.scenarios_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) AS scenario_ids
    FROM chat_resolved_entry c
    JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
    JOIN attempt_entry a2 ON a2.id = ac.attempt_id AND a2.active = TRUE
    LEFT JOIN chat_resolved_scenarios_connection tsc
        ON tsc.chat_resolved_id = c.id AND tsc.active = TRUE
    WHERE c.active = TRUE
    GROUP BY ac.attempt_id
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
    COALESCE(sa_archive.archived, FALSE) AS is_archived,

    -- Scenario IDs (for filtering and display)
    COALESCE(ascn.scenario_ids, ARRAY[]::uuid[]) AS scenario_ids,

    -- Training context (for socket handlers — replaces inline SQL_ATTEMPT_CONTEXT)
    training_ctx.training_entry_id,
    training_ctx.chat_resolved_id

FROM attempt_entry a
-- Attempt connections (required)
JOIN attempt_simulations_connection asc_conn ON asc_conn.attempt_id = a.id
JOIN attempt_profiles_connection apc ON apc.attempt_id = a.id
-- Attempt connections (optional)
LEFT JOIN attempt_departments_connection adc ON adc.attempt_id = a.id
LEFT JOIN attempt_cohorts_connection acc ON acc.attempt_id = a.id
-- Scenario IDs (optional)
LEFT JOIN attempt_scenarios ascn ON ascn.attempt_id = a.id
-- Training context: resolve training_entry_id + chat_resolved_id (LATERAL for 1:1)
LEFT JOIN LATERAL (
    SELECT
        COALESCE(pte.chat_id, hte.chat_id) AS training_entry_id,
        cr.id AS chat_resolved_id
    FROM (SELECT 1) _dummy
    LEFT JOIN attempt_practice_entry ape ON ape.attempt_id = a.id AND ape.active = true
    LEFT JOIN practice_chat_entry pte ON pte.practice_id = ape.practice_id AND pte.active = true
    LEFT JOIN attempt_home_entry ahe ON ahe.attempt_id = a.id AND ahe.active = true
    LEFT JOIN home_chat_entry hte ON hte.home_id = ahe.home_id AND hte.active = true
    LEFT JOIN attempt_chat_entry ac_ctx ON ac_ctx.attempt_id = a.id
    LEFT JOIN chat_resolved_entry cr ON cr.id = ac_ctx.chat_resolved_id AND cr.active = true
    LIMIT 1
) training_ctx ON true
-- Latest archive state (append-only)
LEFT JOIN LATERAL (
    SELECT archived FROM attempt_archive_entry
    WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
) sa_archive ON true
WHERE a.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX attempt_mv_pk
    ON attempt_mv (attempt_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Practice flag for filtering home vs practice
CREATE INDEX attempt_mv_practice_idx
    ON attempt_mv (practice);

-- Profile ID for permission checks and filtering
CREATE INDEX attempt_mv_profile_id_idx
    ON attempt_mv (profile_id);

-- Simulation ID for filtering
CREATE INDEX attempt_mv_simulation_id_idx
    ON attempt_mv (simulation_id);

-- Cohort ID for filtering
CREATE INDEX attempt_mv_cohort_id_idx
    ON attempt_mv (cohort_id)
    WHERE cohort_id IS NOT NULL;

-- Department ID for filtering
CREATE INDEX attempt_mv_department_id_idx
    ON attempt_mv (department_id)
    WHERE department_id IS NOT NULL;

-- Timestamp for sorting
CREATE INDEX attempt_mv_created_at_idx
    ON attempt_mv (attempt_created_at DESC);

-- Composite: profile + simulation
CREATE INDEX attempt_mv_profile_simulation_idx
    ON attempt_mv (profile_id, simulation_id);

-- Composite: practice + profile (common filter pattern)
CREATE INDEX attempt_mv_practice_profile_idx
    ON attempt_mv (practice, profile_id);

-- Archived flag for filtering
CREATE INDEX attempt_mv_is_archived_idx
    ON attempt_mv (is_archived);

-- GIN index on scenario_ids for array overlap filtering
CREATE INDEX attempt_mv_scenario_ids_gin
    ON attempt_mv USING GIN (scenario_ids);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW attempt_mv;
