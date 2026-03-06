-- Search files resources with optional context
-- Query files_resource directly
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of file resources)

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

-- Create function - query files_resource only
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
        (q.files_id, q.generated)::types.q_get_uploads_v4_item
        ORDER BY q.created_at DESC, q.files_id
    ),
    ARRAY[]::types.q_get_uploads_v4_item[]
) as items
FROM (
    SELECT
        ur.id AS files_id,
        COALESCE(ur.generated, false) AS generated,
        ur.created_at
    FROM files_resource ur
    WHERE ur.active = true
      AND (exclude_ids IS NULL OR NOT (ur.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT document OR EXISTS (SELECT 1 FROM document_files_junction j WHERE j.files_id = ur.id AND j.active = true))
    ORDER BY ur.created_at DESC, ur.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
