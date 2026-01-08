-- Create content resource
-- Always INSERT operation (preserves all information)
-- Parameters: content text
-- Returns: content_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_content_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_content_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_content_v4(
    content text
)
RETURNS TABLE (
    content_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_content_id uuid;
BEGIN
    -- INSERT into content table (always insert, never update)
    INSERT INTO content(content, active)
    VALUES (content, true)
    RETURNING id INTO v_content_id;

    RETURN QUERY SELECT v_content_id;
END;
$$;