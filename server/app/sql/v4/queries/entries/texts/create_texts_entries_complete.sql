-- Create texts entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_texts_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_texts_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_texts_entry_v4(
    session_id uuid,
    upload_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO texts_entry (session_id, upload_id, mcp, generated)
    VALUES (api_create_texts_entry_v4.session_id, api_create_texts_entry_v4.upload_id, api_create_texts_entry_v4.mcp, true)
    ON CONFLICT (upload_id) DO UPDATE SET id = texts_entry.id
    RETURNING texts_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
