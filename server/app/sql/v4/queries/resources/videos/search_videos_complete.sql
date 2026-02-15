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
    upload_ids uuid[] DEFAULT ARRAY[]::uuid[],
    completed boolean DEFAULT NULL,
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
            q.id,
            q.name,
            q.description,
            q.length_seconds,
            q.completed,
            q.upload_id,
            q.generated
        )::types.q_get_videos_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_videos_v4_item[]
) as items
FROM (
    SELECT v.id, v.name, COALESCE(v.description, '') AS description, v.length_seconds, COALESCE(v.completed, false) AS completed, v.upload_id, COALESCE(v.generated, false) AS generated
    FROM videos_resource v
    WHERE v.active = true
      AND (exclude_ids IS NULL OR NOT (v.id = ANY(exclude_ids)))
      AND (search IS NULL OR search = '' OR LOWER(v.name) LIKE '%' || LOWER(search) || '%')
      AND (COALESCE(array_length(upload_ids, 1), 0) = 0 OR v.upload_id = ANY(upload_ids))
      AND (completed IS NULL OR v.completed = completed)
      -- Artifact boolean filters
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_videos_junction j WHERE j.video_id = v.id AND j.active = true))
    ORDER BY v.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
