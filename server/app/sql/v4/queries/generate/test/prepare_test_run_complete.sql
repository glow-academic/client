-- Prepare test run: mutations only (create run, config, link profile)
-- Config resolution done in Python via get_test_websocket() + resource internals.

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_test_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_test_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_test_run_v4(
    p_profile_id uuid,
    p_group_id uuid,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    created_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_run_id uuid;
    v_config_id uuid;
    v_created_at timestamptz;
BEGIN
    -- Create new runs_entry
    INSERT INTO runs_entry (group_id, generated, mcp, created_at, updated_at)
    VALUES (p_group_id, true, false, NOW(), NOW())
    RETURNING id, runs_entry.created_at INTO v_run_id, v_created_at;


    -- Link run to agent resources via runs_agents_connection
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_run_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (run_id, agents_id) DO NOTHING;    END IF;

    -- Link profile to run
    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, v_run_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    RETURN QUERY SELECT v_run_id, v_created_at;
END;
$$;
