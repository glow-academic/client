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
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    VALUES (concat('video:', uuidv7()::text), NULL, NULL, '', FALSE, NOW(), NOW())
    RETURNING id
),
insert_video AS (
    INSERT INTO videos (
        name,
        description,
        length_seconds,
        active,
        completed,
        created_at,
        updated_at
    )
    SELECT name, name, length_seconds, TRUE, FALSE, NOW(), NOW()
    FROM tool_call
    RETURNING id
)
SELECT id FROM insert_video
$$;