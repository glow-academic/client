-- Prepare attempt grade: mutations only (run/agent/grade creation)
-- All data fetching is now done in Python from pre-fetched resources
-- group_id and chat_id are resolved in Python and passed directly
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_attempt_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_attempt_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (mutations only)
CREATE OR REPLACE FUNCTION socket_prepare_attempt_grade_v4(
    p_profile_id uuid,
    p_group_id uuid,
    p_chat_id uuid,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    grade_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_run_id uuid;
    v_grade_id uuid;
    v_config_id uuid;
BEGIN
    -- Create run
    INSERT INTO runs_entry (group_id)
    VALUES (0, 0, p_group_id)
    RETURNING id INTO v_run_id;


    -- Link run to agent resources via runs_agents_connection
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_run_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (run_id, agents_id) DO NOTHING;    END IF;

    -- Link run to profile
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, v_run_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    -- Create grade entry
    INSERT INTO attempt_grade_entry (chat_id, run_id, created_at, updated_at, score, passed)
    VALUES (p_chat_id, v_run_id, NOW(), NOW(), 0, false)
    RETURNING id INTO v_grade_id;

    RETURN QUERY SELECT v_run_id, v_grade_id;
END;
$$;
