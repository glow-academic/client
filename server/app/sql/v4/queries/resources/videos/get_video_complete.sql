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

-- Create composite type for video item (upload_id resolved through entry chain)
CREATE TYPE types.q_get_video_resource_v4_item AS (
    video_id uuid,
    name text,
    description text,
    upload_id uuid,
    generated boolean
);

-- Create function (resolves upload_id through entry chain)
CREATE OR REPLACE FUNCTION api_get_video_resource_v4(
    video_id uuid
)
RETURNS TABLE (
    items types.q_get_video_resource_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            v.id,
            v.name,
            COALESCE(v.description, ''),
            vue.upload_id,
            COALESCE(v.generated, false)
        )::types.q_get_video_resource_v4_item
    ),
    ARRAY[]::types.q_get_video_resource_v4_item[]
) as items
FROM videos_resource v
LEFT JOIN videos_videos_connection vvc ON vvc.videos_id = v.id AND vvc.active = true
LEFT JOIN videos_entry ve ON ve.id = vvc.video_id AND ve.active = true
LEFT JOIN video_uploads_entry vue ON vue.video_id = ve.id AND vue.active = true
WHERE v.id = api_get_video_resource_v4.video_id
  AND v.active = true;
$$;
