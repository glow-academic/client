-- Create uploads entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_uploads_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_uploads_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_uploads_entry_v4(
    session_id uuid,
    file_path text,
    mime_type text,
    size bigint,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO uploads_entry (session_id, file_path, mime_type, size, mcp, generated)
    VALUES (api_create_uploads_entry_v4.session_id, api_create_uploads_entry_v4.file_path, api_create_uploads_entry_v4.mime_type, api_create_uploads_entry_v4.size, api_create_uploads_entry_v4.mcp, true)
    RETURNING uploads_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
