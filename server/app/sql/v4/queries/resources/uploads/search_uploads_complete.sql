-- Search uploads resources with optional context
-- CLEAN PATTERN: Query via view_uploads_entry for combined resource+entry data
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of upload resources with file details)

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

-- Create function
CREATE OR REPLACE FUNCTION api_search_uploads_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_uploads_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.upload_id, q.file_path, q.mime_type, q.size, q.generated)::types.q_get_uploads_v4_item
        ORDER BY q.file_path
    ),
    ARRAY[]::types.q_get_uploads_v4_item[]
) as items
FROM (
    SELECT v.id, v.upload_id, v.file_path, v.mime_type, v.size, COALESCE(v.generated, false) AS generated
    FROM view_uploads_entry v
    WHERE v.active = true
      AND v.file_path IS NOT NULL
      AND v.file_path != ''
      -- Search filter (match on file_path)
      AND (search IS NULL OR search = '' OR LOWER(v.file_path) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (v.id = ANY(exclude_ids)))
    ORDER BY v.file_path
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
