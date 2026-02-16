-- ============================================================================
-- Query: get_benchmark_invocations_view
-- Purpose: Fetch invocation-level data from mv_benchmark_invocations with declarative filters
-- Section: VIEWS/BENCHMARK/INVOCATIONS
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
        WHERE typname LIKE 'q_get_benchmark_invocations_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Main invocation item type (IDs from MV - metadata fetched separately via internal handlers)
CREATE TYPE types.q_get_benchmark_invocations_view_v4_item AS (
    -- Primary key
    invocation_id uuid,

    -- Foreign keys
    test_id uuid,
    group_id uuid,
    benchmark_bundle_department_id uuid,

    -- Invocation data
    created_at timestamptz,
    title text,

    -- Grade data
    invocation_completed boolean,
    grade_score integer,
    grade_passed boolean,
    grade_time_taken integer,
    rubric_id uuid,
    grade_id uuid,

    -- Actual execution runs (from invocation-level connection)
    invocation_run_ids uuid[],

    -- Configured resource IDs (from bundle department snapshot)
    -- Arrays (multiple per department)
    run_ids uuid[],
    group_ids uuid[],
    instruction_ids uuid[],
    tool_ids uuid[],
    -- Singular (one per department entry)
    model_id uuid,
    prompt_id uuid,
    voice_id uuid,
    temperature_level_id uuid,
    reasoning_level_id uuid,
    key_id uuid,

    -- Historical runs (all runs in invocation's group)
    historical_run_ids uuid[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_benchmark_invocations_view_v4(
    test_id_filter uuid DEFAULT NULL,
    invocation_ids_filter uuid[] DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_benchmark_invocations_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Fetch from MV with declarative filters
    mv_data AS (
        SELECT mv.*
        FROM mv_benchmark_invocations mv
        WHERE (test_id_filter IS NULL OR mv.test_id = test_id_filter)
          AND (invocation_ids_filter IS NULL OR mv.invocation_id = ANY(invocation_ids_filter))
    ),
    -- No resource JOINs needed - all metadata fetched via internal handlers
    with_resources AS (
        SELECT
            mv.invocation_id,
            mv.test_id,
            mv.group_id,
            mv.benchmark_bundle_department_id,
            mv.invocation_created_at AS created_at,
            mv.invocation_title AS title,
            mv.invocation_completed,
            mv.grade_score,
            mv.grade_passed,
            mv.grade_time_taken,
            mv.rubric_id,
            mv.grade_id,
            -- Actual execution runs
            mv.invocation_run_ids,
            -- Configured resource IDs (from bundle department snapshot)
            mv.run_ids,
            mv.group_ids,
            mv.instruction_ids,
            mv.tool_ids,
            mv.model_id,
            mv.prompt_id,
            mv.voice_id,
            mv.temperature_level_id,
            mv.reasoning_level_id,
            mv.key_id,
            -- Historical runs
            mv.historical_run_ids
        FROM mv_data mv
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    invocation_id,
                    test_id,
                    group_id,
                    benchmark_bundle_department_id,
                    created_at,
                    title,
                    invocation_completed,
                    grade_score,
                    grade_passed,
                    grade_time_taken,
                    rubric_id,
                    grade_id,
                    invocation_run_ids,
                    run_ids,
                    group_ids,
                    instruction_ids,
                    tool_ids,
                    model_id,
                    prompt_id,
                    voice_id,
                    temperature_level_id,
                    reasoning_level_id,
                    key_id,
                    historical_run_ids
                )::types.q_get_benchmark_invocations_view_v4_item
                ORDER BY created_at ASC
            ),
            ARRAY[]::types.q_get_benchmark_invocations_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
