-- Create calls entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_calls_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_calls_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_calls_entry_v4(
    session_id uuid,
    external_call_id text,
    run_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO calls_entry (session_id, external_call_id, run_id, mcp, generated)
    VALUES (api_create_calls_entry_v4.session_id, api_create_calls_entry_v4.external_call_id, api_create_calls_entry_v4.run_id, api_create_calls_entry_v4.mcp, true)
    RETURNING calls_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
