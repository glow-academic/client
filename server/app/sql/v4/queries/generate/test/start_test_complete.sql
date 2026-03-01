-- ============================================================================
-- Query: start_test
-- Purpose: Create a new test with benchmark bridge + profiles connection
-- Section: GENERATE/TEST
--
-- Minimal test creation: just the test_entry, benchmark bridge,
-- and test_profiles_connection.
-- Everything else (invocations, runs, etc.) is resolved by test_proceed.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_start_test_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_start_test_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_start_test_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_start_test_v4_result AS (
    test_id uuid
);

CREATE OR REPLACE FUNCTION socket_start_test_v4(
    p_profile_id uuid,
    p_benchmark_id uuid,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_start_test_v4_result[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_test_id uuid;
    v_profiles_resource_id uuid;
BEGIN
    -- Validate benchmark exists
    IF NOT EXISTS (SELECT 1 FROM benchmark_entry WHERE id = p_benchmark_id) THEN
        RAISE EXCEPTION 'Benchmark % not found', p_benchmark_id;
    END IF;

    -- Resolve profiles_resource_id
    SELECT pp.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction pp
    WHERE pp.profile_id = p_profile_id AND pp.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- 1. Create test_entry
    INSERT INTO test_entry (infinite_mode, generated, mcp, created_at, updated_at)
    VALUES (p_infinite_mode, false, false, NOW(), NOW())
    RETURNING id INTO v_test_id;

    -- 2. Link test → profiles_resource
    INSERT INTO test_profiles_connection (attempt_id, profiles_id, active)
    VALUES (v_test_id, v_profiles_resource_id, true);

    -- 3. Create benchmark bridge
    INSERT INTO test_benchmark_entry (test_id, benchmark_id, created_at, updated_at)
    VALUES (v_test_id, p_benchmark_id, NOW(), NOW());

    RETURN QUERY
    SELECT ARRAY[
        ROW(v_test_id)::types.q_start_test_v4_result
    ];
END;
$$;
