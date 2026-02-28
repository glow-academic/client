-- Create groups entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_groups_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_groups_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_groups_entry_v4(
    session_id uuid,
    name text DEFAULT NULL,
    custom_model boolean DEFAULT false,
    mcp boolean DEFAULT false
) RETURNS TABLE (id uuid)
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
    INSERT INTO groups_entry (session_id, name, custom_model, mcp, generated)
    VALUES (api_create_groups_entry_v4.session_id, api_create_groups_entry_v4.name, api_create_groups_entry_v4.custom_model, api_create_groups_entry_v4.mcp, true)
    RETURNING groups_entry.id INTO v_id;
    RETURN QUERY SELECT v_id;
END; $$;
