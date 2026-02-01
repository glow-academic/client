-- ============================================================================
-- Query: get_simulation_attempts_view
-- Purpose: Fetch attempt-level data from mv_simulation_attempts with resource JOINs
-- Section: VIEWS/SIMULATION/ATTEMPTS
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_attempts_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_attempts_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_simulation_attempts_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_attempts_view_v4_item AS (
    -- Primary key
    attempt_id uuid,

    -- Resource IDs (metadata fetched via internal handlers)
    simulation_id uuid,
    profile_id uuid,
    cohort_id uuid,
    department_id uuid,

    -- Flags
    practice boolean,
    infinite_mode boolean,

    -- Timestamps
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_attempts_view_v4(
    attempt_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_attempts_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Fetch from MV by attempt IDs
    mv_data AS (
        SELECT mv.*
        FROM mv_simulation_attempts mv
        WHERE mv.attempt_id = ANY(COALESCE(attempt_ids, ARRAY[]::uuid[]))
    ),
    -- No resource JOINs needed - all metadata fetched via internal handlers
    -- Aggregates derived in service layer from chats
    with_resources AS (
        SELECT
            mv.attempt_id,
            mv.simulation_id,
            mv.profile_id,
            mv.cohort_id,
            mv.department_id,
            -- Flags
            mv.practice,
            mv.infinite_mode,
            -- Timestamps
            mv.attempt_created_at AS created_at
        FROM mv_data mv
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    attempt_id,
                    simulation_id,
                    profile_id,
                    cohort_id,
                    department_id,
                    practice,
                    infinite_mode,
                    created_at
                )::types.q_get_simulation_attempts_view_v4_item
                ORDER BY created_at DESC
            ),
            ARRAY[]::types.q_get_simulation_attempts_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
