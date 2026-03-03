-- Create runs entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_runs_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_runs_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_runs_entry_v4(
    session_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    profiles_id uuid DEFAULT NULL,
    agent_ids uuid[] DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE
    v_id uuid;
    v_agent_id uuid;
BEGIN
    INSERT INTO runs_entry (session_id, group_id, mcp, generated)
    VALUES (api_create_runs_entry_v4.session_id, api_create_runs_entry_v4.group_id, api_create_runs_entry_v4.mcp, true)
    RETURNING runs_entry.id INTO v_id;

    -- Link run → profiles_resource if provided
    IF api_create_runs_entry_v4.profiles_id IS NOT NULL THEN
        INSERT INTO profiles_runs_connection (profiles_id, run_id)
        VALUES (api_create_runs_entry_v4.profiles_id, v_id);
    END IF;

    -- Link run → agents_resource if provided
    IF api_create_runs_entry_v4.agent_ids IS NOT NULL THEN
        FOREACH v_agent_id IN ARRAY api_create_runs_entry_v4.agent_ids
        LOOP
            INSERT INTO runs_agents_connection (run_id, agents_id)
            VALUES (v_id, v_agent_id);
        END LOOP;
    END IF;

    RETURN QUERY SELECT v_id;
END; $$;
