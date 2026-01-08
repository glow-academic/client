-- Create images resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, description text
-- Returns: image_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_images_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_images_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_images_v4(
    name text, description text
)
RETURNS TABLE (
    image_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_image_id uuid;
BEGIN
    -- INSERT into images table (always insert, never update)
    INSERT INTO images(name, description, active)
    VALUES (name, description, true)
    RETURNING id INTO v_image_id;

    RETURN QUERY SELECT v_image_id;
END;
$$;