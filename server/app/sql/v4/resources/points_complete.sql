-- Create points resource
-- Always INSERT operation (preserves all information)
-- Parameters: value numeric
-- Returns: point_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_points_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_points_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_points_v4(
    value numeric
)
RETURNS TABLE (
    point_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_point_id uuid;
BEGIN
    -- INSERT into points table (always insert, never update)
    INSERT INTO points(value, active)
    VALUES (value, true)
    RETURNING id INTO v_point_id;

    RETURN QUERY SELECT v_point_id;
END;
$$;