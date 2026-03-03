-- Start benchmark attempt: creates test entry and links to profile/eval.
-- Invocation creation is handled separately by socket_create_test_invocations_v4.

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_start_benchmark_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_start_benchmark_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_start_benchmark_attempt_v4(
    p_profile_id uuid,
    p_eval_id uuid,
    p_infinite_mode boolean DEFAULT false
)
RETURNS TABLE (
    attempt_id uuid,
    eval_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
    v_profiles_resource_id uuid;
BEGIN
    -- Validate eval exists
    IF NOT EXISTS (SELECT 1 FROM eval_artifact WHERE id = p_eval_id) THEN
        RETURN QUERY SELECT NULL::uuid, NULL::uuid;
        RETURN;
    END IF;

    -- Resolve profile_artifact ID → profiles_resource ID
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id AND ppj.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Create test_entry (test)
    INSERT INTO test_entry (infinite_mode, generated, mcp, created_at, updated_at)
    VALUES (p_infinite_mode, false, false, NOW(), NOW())
    RETURNING id INTO v_attempt_id;

    -- Link attempt to profile (using resource ID)
    INSERT INTO test_profiles_connection (attempt_id, profiles_id, active)
    VALUES (v_attempt_id, v_profiles_resource_id, true);

    -- Link attempt to eval
    INSERT INTO test_evals_connection (attempt_id, eval_id, active)
    VALUES (v_attempt_id, p_eval_id, true);

    RETURN QUERY SELECT v_attempt_id, p_eval_id;
END;
$$;
