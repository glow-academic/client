-- Create flags resource
-- Always INSERT operation (preserves all information)
-- Parameters: name (text), description (text), icon_id (uuid)
-- Returns: flag_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_flags_v4(
    name text, description text, icon_id uuid
)
RETURNS TABLE (
    flag_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_flag_id uuid;
BEGIN
    -- INSERT into flags table (always insert, never update)
    INSERT INTO flags(name, description, icon_id, active)
    VALUES (name, description, icon_id, true)
    RETURNING id INTO v_flag_id;
    
    RETURN QUERY SELECT v_flag_id;
END;
$$;
