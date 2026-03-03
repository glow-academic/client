-- Search auths resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of auth resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_auths_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_auths_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_auths_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    auth boolean DEFAULT false,
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_auths_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.department_ids, q.slug, q.protocol, q.generated)::types.q_get_auths_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_auths_v4_item[]
) as items
FROM (
    SELECT a.id, a.name, a.description, a.department_ids, a.slug, a.protocol, COALESCE(a.generated, false) AS generated
    FROM auths_resource a
    WHERE a.active = true
      -- Search filter (OR across name, description, slug, protocol)
      AND (search IS NULL OR search = '' OR
           LOWER(a.name) LIKE '%' || LOWER(search) || '%' OR
           LOWER(a.description) LIKE '%' || LOWER(search) || '%' OR
           LOWER(a.slug) LIKE '%' || LOWER(search) || '%' OR
           LOWER(a.protocol) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (a.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR a.department_ids && department_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT auth OR EXISTS (SELECT 1 FROM auth_auths_junction j WHERE j.auth_id = a.id AND j.active = true))
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_auths_junction j WHERE j.auth_id = a.id AND j.active = true))
    ORDER BY a.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
