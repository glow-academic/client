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

-- Create function (resolves upload_id through entry chain)
CREATE OR REPLACE FUNCTION api_search_images_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    upload_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    scenario boolean DEFAULT false
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
            q.id,
            q.name,
            q.description,
            q.upload_id,
            q.generated
        )::types.q_get_images_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_images_v4_item[]
) as items
FROM (
    SELECT i.id, i.name, COALESCE(i.description, '') AS description,
           ie.upload_id,
           COALESCE(i.generated, false) AS generated
    FROM images_resource i
    LEFT JOIN images_images_connection iic ON iic.images_id = i.id AND iic.active = true
    LEFT JOIN images_entry ie ON ie.id = iic.image_id AND ie.active = true
    WHERE i.active = true
      AND (exclude_ids IS NULL OR NOT (i.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(upload_ids, 1), 0) = 0 OR ie.upload_id = ANY(upload_ids))
      AND (search IS NULL OR search = '' OR LOWER(i.name) LIKE '%' || LOWER(search) || '%')
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT scenario OR EXISTS (SELECT 1 FROM scenario_images_junction j WHERE j.image_id = i.id AND j.active = true))
    ORDER BY i.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
