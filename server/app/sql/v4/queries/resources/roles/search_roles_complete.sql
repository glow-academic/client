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
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_roles_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.role, q.name, q.description, q.icon_value, q.color_hex)::types.q_get_roles_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_roles_v4_item[]
) as items
FROM (
    SELECT
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
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
