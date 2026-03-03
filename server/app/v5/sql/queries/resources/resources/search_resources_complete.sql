-- Search resources resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of resource resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_resources_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_resources_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_resources_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    resource text DEFAULT NULL,
    creatable boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    tool boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_resources_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.resource, q.creatable, q.generated)::types.q_get_resources_v4_item
        ORDER BY q.resource
    ),
    ARRAY[]::types.q_get_resources_v4_item[]
) as items
FROM (
    SELECT r.id, r.resource::text, COALESCE(r.creatable, false) AS creatable, COALESCE(r.generated, false) AS generated
    FROM resources_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.resource::text) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      AND (api_search_resources_v4.resource IS NULL OR r.resource::text = api_search_resources_v4.resource)
      AND (creatable IS NULL OR r.creatable = creatable)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT tool OR EXISTS (SELECT 1 FROM tool_resources_junction j WHERE j.resource_id = r.id AND j.active = true))
    ORDER BY r.resource::text
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
