-- Create names resource
-- Always INSERT operation (preserves all information)
-- Parameters: name (text)
-- Returns: name_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_names_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_names_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_names_v4(
    name text
)
RETURNS TABLE (
    name_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_name_id uuid;
BEGIN
    -- INSERT into names table (always insert, never update)
    INSERT INTO names(name, active)
    VALUES (name, true)
    RETURNING id INTO v_name_id;
    
    RETURN QUERY SELECT v_name_id;
END;
$$;
