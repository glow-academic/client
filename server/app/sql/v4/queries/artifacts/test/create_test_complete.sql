-- Create benchmark test entry via REST.
-- Calls socket_start_benchmark_attempt_v4 for test creation,
-- then socket_create_test_invocations_v4 for invocation creation.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'create_test_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS create_test_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION create_test_v4(
    p_profile_id uuid,
    p_eval_id uuid,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    test_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_test_id uuid;
BEGIN
    -- Step 1: Create test entry + links
    SELECT s.attempt_id INTO v_test_id
    FROM socket_start_benchmark_attempt_v4(p_profile_id, p_eval_id, p_infinite_mode) s
    LIMIT 1;

    IF v_test_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create benchmark test for eval %', p_eval_id;
    END IF;

    -- Step 2: Create invocations
    PERFORM * FROM socket_create_test_invocations_v4(v_test_id, p_eval_id);

    RETURN QUERY SELECT v_test_id;
END;
$$;
