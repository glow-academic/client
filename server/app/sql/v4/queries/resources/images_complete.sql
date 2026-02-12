-- Create images resource
-- Get or create operation (returns existing ID if name already exists)
-- Parameters: name (text), description (text), mcp (boolean, optional)
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
    name text,
    description text,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    image_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_image_id uuid;
BEGIN
    -- Check if images already exists (match on name)
    SELECT r.id INTO v_image_id
    FROM images_resource r
    WHERE r.name = api_create_images_v4.name
    LIMIT 1;

    IF v_image_id IS NOT NULL THEN
        RETURN QUERY SELECT v_image_id;
        RETURN;
    END IF;

    -- INSERT INTO images_resource table (always insert, never update)
    INSERT INTO images_resource(name, description, active, mcp)
    VALUES (name, description, true, mcp)
    RETURNING id INTO v_image_id;

    RETURN QUERY SELECT v_image_id;
END;
$$;
