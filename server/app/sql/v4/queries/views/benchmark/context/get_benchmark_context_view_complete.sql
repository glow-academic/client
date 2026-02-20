-- ============================================================================
-- Query: get_benchmark_context_view
-- Purpose: IDs-first benchmark context for artifact hydration (thin MV filter layer)
-- Section: VIEWS/BENCHMARK/CONTEXT
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_benchmark_context_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_benchmark_context_view_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_benchmark_context_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_benchmark_context_view_v4_item AS (
    benchmark_id uuid,
    eval_ids uuid[],
    invocation_entry_ids uuid[],
    department_ids uuid[],
    profile_ids uuid[],
    run_rubric_ids uuid[],
    group_rubric_ids uuid[],
    run_position_ids uuid[],
    group_position_ids uuid[],
    use_groups boolean,
    dynamic boolean
);

CREATE OR REPLACE FUNCTION api_get_benchmark_context_view_v4(
    profile_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_benchmark_context_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        profile_id_filter AS profile_id
),
-- User departments via profile_departments_junction
user_departments AS (
    SELECT ARRAY_AGG(DISTINCT pdj.department_id) AS department_ids
    FROM profile_departments_junction pdj
    WHERE pdj.profile_id = (SELECT profile_id FROM params)
      AND pdj.active = true
),
-- Filter benchmark_mv: department overlap
accessible_benchmarks AS (
    SELECT mb.*
    FROM benchmark_mv mb
    JOIN user_departments ud
      ON mb.department_ids && COALESCE(ud.department_ids, ARRAY[]::uuid[])
)
SELECT
    COALESCE(
        (
            SELECT ARRAY_AGG(
                (
                    ab.benchmark_id,
                    ab.eval_ids,
                    ab.invocation_entry_ids,
                    ab.department_ids,
                    ab.profile_ids,
                    ab.run_rubric_ids,
                    ab.group_rubric_ids,
                    ab.run_position_ids,
                    ab.group_position_ids,
                    ab.use_groups,
                    ab.dynamic
                )::types.q_get_benchmark_context_view_v4_item
                ORDER BY ab.benchmark_id
            )
            FROM accessible_benchmarks ab
            WHERE ab.eval_ids IS NOT NULL
              AND ARRAY_LENGTH(ab.eval_ids, 1) > 0
        ),
        ARRAY[]::types.q_get_benchmark_context_view_v4_item[]
    ) AS items;
$$;
