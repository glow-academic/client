-- Search roles resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of roles resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_roles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_roles_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_roles_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    role text DEFAULT NULL,
    icon_ids uuid[] DEFAULT ARRAY[]::uuid[],
    color_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    profile boolean DEFAULT false,
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_roles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.role, q.name, q.description, q.icon_value, q.color_hex)::types.q_get_roles_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_roles_v4_item[]
) as items
FROM (
    SELECT
        r.id,
        r.role::text,
        r.name,
        r.description,
        i.value AS icon_value,
        c.hex_code AS color_hex
    FROM roles_resource r
    LEFT JOIN icons_resource i ON i.id = r.icon_id
    LEFT JOIN colors_resource c ON c.id = r.color_id
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.role::text) LIKE '%' || LOWER(search) || '%' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(r.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      AND (api_search_roles_v4.role IS NULL OR r.role::text = api_search_roles_v4.role)
      AND (COALESCE(array_length(icon_ids, 1), 0) = 0 OR r.icon_id = ANY(icon_ids))
      AND (COALESCE(array_length(color_ids, 1), 0) = 0 OR r.color_id = ANY(color_ids))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_roles_junction j WHERE j.roles_id = r.id AND j.active = true))
      AND (NOT setting OR false)
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
