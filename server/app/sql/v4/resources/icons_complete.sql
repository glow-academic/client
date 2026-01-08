-- Create icons resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, description text, value numeric
-- Returns: icon_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_icons_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_icons_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_icons_v4(
    name text, description text, value numeric
)
RETURNS TABLE (
    icon_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_icon_id uuid;
BEGIN
    -- INSERT into icons table (always insert, never update)
    INSERT INTO icons(name, description, value, active)
    VALUES (name, description, value, true)
    RETURNING id INTO v_icon_id;

    RETURN QUERY SELECT v_icon_id;
END;
$$;