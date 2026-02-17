-- Prepare profile generation: mutations only (group/run/config creation)
-- All data fetching is now done in Python from pre-fetched denormalized resources
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_profile_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_profile_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function (mutations only)
CREATE OR REPLACE FUNCTION socket_prepare_profile_generation_v4(
    p_profile_id uuid,
    p_group_id uuid DEFAULT NULL,
    p_agents_resource_id uuid DEFAULT NULL,
    p_models_resource_id uuid DEFAULT NULL,
    p_providers_resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    trace_id text,
    config_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_group_id uuid;
    v_trace_id text;
    v_config_id uuid;
    v_run_id uuid;
BEGIN
    -- Get or create group
    IF p_group_id IS NOT NULL THEN
        SELECT g.id, g.trace_id INTO v_group_id, v_trace_id
        FROM groups_entry g
        WHERE g.id = p_group_id
        LIMIT 1;
    END IF;

    IF v_group_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = p_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
        RETURNING id, groups_entry.trace_id INTO v_group_id, v_trace_id;
    END IF;

    IF v_group_id IS NULL THEN
        v_group_id := gen_random_uuid();
        v_trace_id := gen_random_uuid()::text;
    END IF;

    INSERT INTO runs_entry (group_id)
    VALUES (v_group_id)
    RETURNING id INTO v_run_id;

    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active, run_id)
    VALUES (NOW(), NOW(), false, false, true, v_run_id)
    RETURNING id INTO v_config_id;

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

    INSERT INTO profiles_runs_connection (profiles_id, run_id)
    VALUES (p_profile_id, v_run_id);

    RETURN QUERY SELECT v_run_id, v_group_id, v_trace_id::text, v_config_id;
END;
$$;
