-- Search videos resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of video resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_videos_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_videos_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function (uses denormalized upload_id directly from videos_resource)
CREATE OR REPLACE FUNCTION api_search_videos_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    scenario boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_videos_v4_item[]
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
            v.length_seconds,
            COALESCE(v.completed, false),
            v.upload_id,
            COALESCE(v.generated, false)
        )::types.q_get_videos_v4_item
        ORDER BY v.name
    ),
    ARRAY[]::types.q_get_videos_v4_item[]
) as items
FROM videos_resource v
WHERE v.active = true
  AND (exclude_ids IS NULL OR NOT (v.id = ANY(exclude_ids)))
  AND (search IS NULL OR search = '' OR LOWER(v.name) LIKE '%' || LOWER(search) || '%')
  -- Artifact boolean filters
  AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_videos_junction j WHERE j.video_id = v.id AND j.active = true))
LIMIT limit_count
OFFSET offset_count;
$$;
