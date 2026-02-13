-- Search uploads resources with optional context
-- Query uploads_resource + uploads_uploads_connection only (no view_uploads_entry)
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of upload resources with upload_id from connection)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_uploads_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_uploads_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function - query uploads_resource + connection only
CREATE OR REPLACE FUNCTION api_search_uploads_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    document boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_uploads_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.uploads_id, q.upload_id, q.generated)::types.q_get_uploads_v4_item
        ORDER BY q.created_at DESC
    ),
    ARRAY[]::types.q_get_uploads_v4_item[]
) as items
FROM (
    SELECT
        ur.id AS uploads_id,
        uuc.upload_id,
        COALESCE(ur.generated, false) AS generated,
        ur.created_at
    FROM uploads_resource ur
    LEFT JOIN uploads_uploads_connection uuc ON uuc.uploads_id = ur.id AND uuc.active = true
    WHERE ur.active = true
      AND (exclude_ids IS NULL OR NOT (ur.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT document OR EXISTS (SELECT 1 FROM document_uploads_junction j WHERE j.uploads_id = ur.id AND j.active = true))
    ORDER BY ur.created_at DESC
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
