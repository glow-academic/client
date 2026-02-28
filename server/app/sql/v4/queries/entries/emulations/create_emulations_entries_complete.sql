-- Create emulations entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_emulations_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_emulations_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_emulations_entry_v4(
    session_id uuid,
    grant_id uuid,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO emulations_entry (session_id, grant_id, mcp, generated)
    VALUES (api_create_emulations_entry_v4.session_id, api_create_emulations_entry_v4.grant_id, api_create_emulations_entry_v4.mcp, true)
    RETURNING emulations_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
