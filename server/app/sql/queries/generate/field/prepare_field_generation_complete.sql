-- Prepare field generation: mutations only (group/run/config creation)
-- All data fetching is now done in Python from pre-fetched denormalized resources
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_field_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_field_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (mutations only)
CREATE OR REPLACE FUNCTION socket_prepare_field_generation_v4(
    p_profile_id uuid,
    p_group_id uuid DEFAULT NULL,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    config_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_group_id uuid;
    v_config_id uuid;
    v_run_id uuid;
BEGIN
    -- Get or create group
    IF p_group_id IS NOT NULL THEN
        SELECT g.id INTO v_group_id
        FROM groups_entry g
        WHERE g.id = p_group_id
        LIMIT 1;
    END IF;

    IF v_group_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (SELECT s.id FROM sessions_entry s JOIN profiles_sessions_connection psc ON psc.session_id = s.id WHERE psc.profiles_id = p_profile_id AND s.active = true ORDER BY s.created_at DESC LIMIT 1))
        RETURNING id INTO v_group_id;
    END IF;

    IF v_group_id IS NULL THEN
        v_group_id := gen_random_uuid();
    END IF;

    INSERT INTO runs_entry (group_id)
    VALUES (v_group_id)
    RETURNING id INTO v_run_id;

    -- Link run to agent resources via runs_agents_connection
    IF p_agents_resource_id IS NOT NULL THEN
        INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
        VALUES (v_run_id, p_agents_resource_id, NOW(), true, false, false)
        ON CONFLICT (run_id, agents_id) DO NOTHING;    END IF;

    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    SELECT ppj.profiles_id, v_run_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    RETURN QUERY SELECT v_run_id, v_group_id, v_config_id;
END;
$$;
