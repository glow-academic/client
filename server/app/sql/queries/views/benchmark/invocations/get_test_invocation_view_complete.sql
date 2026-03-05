-- ============================================================================
-- Query: get_test_invocation_view
-- Purpose: Fetch invocation-level data from test_invocation_mv
-- Section: VIEWS/BENCHMARK/INVOCATIONS
--
-- Includes:
-- - Filtering (test_id, invocation_ids)
-- - All invocation resource IDs and grade data
--
-- Note: Returns resource IDs only. Metadata (names, descriptions) fetched via internal handlers.
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_benchmark_invocations_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_invocations_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_test_invocation_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_test_invocation_view_v4_item AS (
    -- Primary key
    invocation_id uuid,

    -- Foreign keys
    test_id uuid,
    group_id uuid,

    -- Invocation data
    invocation_created_at timestamptz,
    invocation_title text,
    use_custom boolean,
    position int,

    -- Grade data
    invocation_completed boolean,
    grade_id uuid,
    grade_score int,
    grade_passed boolean,
    grade_time_taken int,
    rubric_id uuid,

    -- Department IDs
    department_ids uuid[],

    -- Resource IDs
    run_ids uuid[],
    group_ids uuid[],
    run_agent_ids uuid[],
    group_agent_ids uuid[],

    -- Singular resource IDs
    model_id uuid,
    voice_id uuid,
    temperature_levels_id uuid,
    reasoning_levels_id uuid,
    key_id uuid,

    -- Historical runs
    historical_run_ids uuid[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_benchmark_invocations_view_v4(
    -- Filters
    test_id_filter uuid DEFAULT NULL,
    invocation_ids_filter uuid[] DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_test_invocation_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT *
        FROM test_invocation_mv ti
        WHERE
            (test_id_filter IS NULL OR ti.test_id = test_id_filter)
            AND (invocation_ids_filter IS NULL OR cardinality(invocation_ids_filter) = 0 OR ti.invocation_id = ANY(invocation_ids_filter))
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    invocation_id,
                    test_id,
                    group_id,
                    invocation_created_at,
                    invocation_title,
                    use_custom,
                    position,
                    invocation_completed,
                    grade_id,
                    grade_score,
                    grade_passed,
                    grade_time_taken,
                    rubric_id,
                    department_ids,
                    run_ids,
                    group_ids,
                    run_agent_ids,
                    group_agent_ids,
                    model_id,
                    voice_id,
                    temperature_levels_id,
                    reasoning_levels_id,
                    key_id,
                    historical_run_ids
                )::types.q_get_test_invocation_view_v4_item
                ORDER BY position ASC NULLS LAST, invocation_created_at ASC
            ),
            ARRAY[]::types.q_get_test_invocation_view_v4_item[]
        ) AS items
        FROM filtered
    )
    SELECT (SELECT items FROM items_agg);
$$;
