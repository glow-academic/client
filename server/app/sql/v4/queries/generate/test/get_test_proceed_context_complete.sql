-- ============================================================================
-- Query: get_test_proceed_context
-- Purpose: Resolve all context needed by test_proceed in a single query
-- Section: GENERATE/TEST
--
-- Given a test_id, returns:
--   - total_invocations, completed_count (done check)
--   - next invocation_entry_id (NULL if all done)
--   - use_custom flag from invocation_entry
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_test_proceed_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_test_proceed_context_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_test_proceed_context_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_test_proceed_context_v4_result AS (
    total_invocations int,
    completed_count int,
    invocation_entry_id uuid,
    -- TODO: add use_custom column to invocation_entry
    use_custom boolean
);

CREATE OR REPLACE FUNCTION socket_get_test_proceed_context_v4(
    p_test_id uuid
)
RETURNS TABLE (
    items types.q_get_test_proceed_context_v4_result[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_benchmark_id uuid;
    v_total_invocations int;
    v_completed_count int;
    v_next_invocation_entry_id uuid;
    v_use_custom boolean;
BEGIN
    -- 1. Resolve benchmark_id from test_benchmark_entry
    SELECT tbe.benchmark_id INTO v_benchmark_id
    FROM test_benchmark_entry tbe
    WHERE tbe.test_id = p_test_id AND tbe.active = true
    LIMIT 1;

    IF v_benchmark_id IS NULL THEN
        RAISE EXCEPTION 'No benchmark found for test %', p_test_id;
    END IF;

    -- 2. Count total invocations for this benchmark
    SELECT COUNT(*)::int INTO v_total_invocations
    FROM invocation_entry ie
    WHERE ie.benchmark_id = v_benchmark_id AND ie.active = true;

    -- 3. Count completed (test_invocation_entries already bridged for this test)
    SELECT COUNT(*)::int INTO v_completed_count
    FROM test_invocation_bridge_entry tib
    JOIN test_invocation_entry tie ON tie.id = tib.test_invocation_id AND tie.active = true
    WHERE tie.test_id = p_test_id AND tib.active = true;

    -- 4. Find next invocation_entry not yet resolved
    SELECT ie.id INTO v_next_invocation_entry_id
    FROM invocation_entry ie
    WHERE ie.benchmark_id = v_benchmark_id
      AND ie.active = true
      AND ie.id NOT IN (
          SELECT tib.invocation_id
          FROM test_invocation_bridge_entry tib
          JOIN test_invocation_entry tie ON tie.id = tib.test_invocation_id AND tie.active = true
          WHERE tie.test_id = p_test_id AND tib.active = true
      )
    ORDER BY ie.created_at
    LIMIT 1;

    -- If no next invocation, return with NULLs (caller checks completed_count >= total)
    IF v_next_invocation_entry_id IS NULL THEN
        RETURN QUERY
        SELECT ARRAY[
            ROW(v_total_invocations, v_completed_count, NULL::uuid, false)
                ::types.q_get_test_proceed_context_v4_result
        ];
        RETURN;
    END IF;

    -- 5. Get use_custom from invocation_entry
    -- TODO: add use_custom column to invocation_entry, currently defaults to false
    SELECT COALESCE(ie.use_custom, false) INTO v_use_custom
    FROM invocation_entry ie
    WHERE ie.id = v_next_invocation_entry_id;

    RETURN QUERY
    SELECT ARRAY[
        ROW(v_total_invocations, v_completed_count, v_next_invocation_entry_id, v_use_custom)
            ::types.q_get_test_proceed_context_v4_result
    ];
END;
$$;
