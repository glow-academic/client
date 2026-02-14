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

-- Feedback item type
CREATE TYPE types.q_get_benchmark_invocations_view_v4_feedback AS (
    id uuid,
    total integer,
    feedback text,
    total_points integer,
    pass_points integer
);

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

    -- Feedbacks
    feedbacks types.q_get_benchmark_invocations_view_v4_feedback[],

    -- Actual execution runs (from invocation-level connection)
    invocation_run_ids uuid[],

    -- Configured resource IDs (from bundle department snapshot)
    run_ids uuid[],
    group_ids uuid[],
    model_ids uuid[],
    prompt_ids uuid[],
    instruction_ids uuid[],
    voice_ids uuid[],
    temperature_level_ids uuid[],
    reasoning_level_ids uuid[],
    tool_ids uuid[],
    key_ids uuid[]
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
    -- Transform feedbacks from MV composite type to query composite type
    feedbacks_transformed AS (
        SELECT
            mv.invocation_id,
            COALESCE(
                ARRAY_AGG(
                    (
                        (f).id,
                        (f).total,
                        (f).feedback,
                        (f).total_points,
                        (f).pass_points
                    )::types.q_get_benchmark_invocations_view_v4_feedback
                    ORDER BY (f).id
                ) FILTER (WHERE (f).id IS NOT NULL),
                ARRAY[]::types.q_get_benchmark_invocations_view_v4_feedback[]
            ) AS feedbacks
        FROM mv_data mv
        LEFT JOIN LATERAL unnest(mv.feedbacks) AS f ON true
        GROUP BY mv.invocation_id
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
            ft.feedbacks,
            -- Actual execution runs
            mv.invocation_run_ids,
            -- Configured resource IDs (from bundle department snapshot)
            mv.run_ids,
            mv.group_ids,
            mv.model_ids,
            mv.prompt_ids,
            mv.instruction_ids,
            mv.voice_ids,
            mv.temperature_level_ids,
            mv.reasoning_level_ids,
            mv.tool_ids,
            mv.key_ids
        FROM mv_data mv
        LEFT JOIN feedbacks_transformed ft ON ft.invocation_id = mv.invocation_id
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
                    feedbacks,
                    invocation_run_ids,
                    run_ids,
                    group_ids,
                    model_ids,
                    prompt_ids,
                    instruction_ids,
                    voice_ids,
                    temperature_level_ids,
                    reasoning_level_ids,
                    tool_ids,
                    key_ids
                )::types.q_get_benchmark_invocations_view_v4_item
                ORDER BY created_at ASC
            ),
            ARRAY[]::types.q_get_benchmark_invocations_view_v4_item[]
        ) AS items
        FROM with_resources
    )
    SELECT items FROM items_agg;
$$;
