-- Prepare attempt grade: mutations only (run/config/grade creation)
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

    -- Create config snapshot with run_id
    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active, run_id)
    VALUES (NOW(), NOW(), false, false, true, v_run_id)
    RETURNING id INTO v_config_id;

    -- Config connections (agents, models, providers)
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, agents_id) DO NOTHING;
    END IF;

    IF p_models_resource_id IS NOT NULL THEN
        INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_models_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, models_id) DO NOTHING;
    END IF;

    IF p_providers_resource_id IS NOT NULL THEN
        INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
        VALUES (v_config_id, p_providers_resource_id, NOW(), true, false, false)
        ON CONFLICT (config_id, providers_id) DO NOTHING;
    END IF;

    -- Link run to profile
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Create grade entry
    INSERT INTO simulation_grades_entry (chat_id, run_id, created_at, updated_at, score, passed)
    VALUES (p_chat_id, v_run_id, NOW(), NOW(), 0, false)
    RETURNING id INTO v_grade_id;

    RETURN QUERY SELECT v_run_id, v_grade_id;
END;
$$;
