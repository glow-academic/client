-- Create standard_groups resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, short_name text, description text, points numeric, pass_points numeric
-- Returns: standard_group_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_standard_groups_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_standard_groups_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_standard_groups_v4(
    name text, short_name text, description text, points numeric, pass_points numeric
)
RETURNS TABLE (
    standard_group_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_standard_group_id uuid;
BEGIN
    -- INSERT into standard_groups table (always insert, never update)
    INSERT INTO standard_groups(name, short_name, description, points, pass_points, active)
    VALUES (name, short_name, description, points, pass_points, true)
    RETURNING id INTO v_standard_group_id;

    RETURN QUERY SELECT v_standard_group_id;
END;
$$;