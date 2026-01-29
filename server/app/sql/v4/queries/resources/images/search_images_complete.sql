-- Search images resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of image resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_images_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_images_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_images_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_images_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            i.id,
            i.name,
            COALESCE(u.file_path, ''),
            COALESCE(u.mime_type, ''),
            COALESCE(iuc.upload_id, i.id),
            COALESCE(i.generated, false)
        )::types.q_get_images_v4_item
        ORDER BY i.name
    ),
    ARRAY[]::types.q_get_images_v4_item[]
) as items
FROM images_resource i
LEFT JOIN images_uploads_connection iuc ON iuc.images_id = i.id
LEFT JOIN view_uploads_entry u ON u.id = iuc.upload_id
WHERE i.active = true
  AND (exclude_ids IS NULL OR NOT (i.id = ANY(exclude_ids)))
  AND (search IS NULL OR search = '' OR LOWER(i.name) LIKE '%' || LOWER(search) || '%')
LIMIT limit_count
OFFSET offset_count;
$$;
