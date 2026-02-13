-- Search items resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of items resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_items_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_items_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_items_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    auth boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_items_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.encrypted, q.position, q.generated)::types.q_get_items_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_items_v4_item[]
) as items
FROM (
    SELECT r.id, r.name, r.description, r.encrypted, r.position, COALESCE(r.generated, false) AS generated
    FROM items_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(r.description) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_items_junction j WHERE j.item_id = r.id AND j.active = true))
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
