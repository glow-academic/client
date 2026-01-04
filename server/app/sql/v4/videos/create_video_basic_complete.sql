-- Create basic video record with tool call
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_video_basic_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_video_basic_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_create_video_basic_v4(
    name text,
    length_seconds integer
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    VALUES (concat('video:', uuidv7()::text), NULL, FALSE, NOW(), NOW())
    RETURNING id
),
insert_video AS (
    INSERT INTO videos (
        name,
        length_seconds,
        active,
        image_enabled,
        completed,
        tool_call_id,
        created_at,
        updated_at
    )
    SELECT name, length_seconds, TRUE, TRUE, FALSE, tool_call.id, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_video
$$;