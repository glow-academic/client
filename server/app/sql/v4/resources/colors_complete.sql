-- Create colors resource
-- Always INSERT operation (preserves all information)
-- Parameters: name (text), description (text), hex_code (text)
-- Returns: color_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_colors_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_colors_v4(
    name text, description text, hex_code text
)
RETURNS TABLE (
    color_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_color_id uuid;
BEGIN
    -- INSERT into colors table (always insert, never update)
    INSERT INTO colors(name, description, hex_code, active)
    VALUES (name, description, hex_code, true)
    RETURNING id INTO v_color_id;
    
    RETURN QUERY SELECT v_color_id;
END;
$$;
