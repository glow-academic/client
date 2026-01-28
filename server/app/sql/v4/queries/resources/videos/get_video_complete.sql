-- Get video resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single video resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_video_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_video_resource_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_video_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for video item
CREATE TYPE types.q_get_video_resource_v4_item AS (
    video_id uuid,
    name text,
    length_seconds bigint,
    completed boolean,
    file_path text,
    mime_type text,
    upload_id uuid,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_video_resource_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_video_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        v.id,
        v.name,
        v.length_seconds,
        COALESCE(v.completed, false),
        v.file_path,
        v.mime_type,
        v.upload_id,
        COALESCE(v.generated, false)
    )::types.q_get_video_resource_v4_item as item
FROM videos_resource v
WHERE v.id = id
  AND v.active = true;
$$;
