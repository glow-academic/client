-- Create videos resource
-- Always INSERT operation (preserves all information)
-- Parameters: name text, length_seconds numeric, description text
-- Returns: video_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_videos_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_videos_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_videos_v4(
    name text, length_seconds numeric, description text
)
RETURNS TABLE (
    video_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_video_id uuid;
BEGIN
    -- INSERT into videos table (always insert, never update)
    INSERT INTO videos(name, length_seconds, description, active)
    VALUES (name, length_seconds, description, true)
    RETURNING id INTO v_video_id;

    RETURN QUERY SELECT v_video_id;
END;
$$;