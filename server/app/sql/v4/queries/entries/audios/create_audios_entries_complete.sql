-- Create audios entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_audios_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_audios_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_audios_entry_v4(
    session_id uuid,
    message_id uuid DEFAULT NULL,
    length_seconds integer DEFAULT 0,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO audios_entry (session_id, message_id, length_seconds, mcp, generated)
    VALUES (api_create_audios_entry_v4.session_id, api_create_audios_entry_v4.message_id, api_create_audios_entry_v4.length_seconds, api_create_audios_entry_v4.mcp, true)
    RETURNING audios_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
