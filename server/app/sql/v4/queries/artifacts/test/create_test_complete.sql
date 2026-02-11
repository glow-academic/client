-- Create benchmark test entry via REST.
-- Wraps socket_start_benchmark_attempt_v4 to return just the test_id.

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
    -- Delegate to the existing socket function
    SELECT s.attempt_id INTO v_test_id
    FROM socket_start_benchmark_attempt_v4(p_profile_id, p_eval_id, p_infinite_mode) s
    LIMIT 1;

    IF v_test_id IS NULL THEN
        RAISE EXCEPTION 'Failed to create benchmark test for eval %', p_eval_id;
    END IF;

    RETURN QUERY SELECT v_test_id;
END;
$$;
