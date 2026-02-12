-- Search providers resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of providers resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_providers_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_providers_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_providers_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_providers_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.value, q.name, q.description, q.endpoint, q.key, q.active, q.generated)::types.q_get_providers_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_providers_v4_item[]
) as items
FROM (
    SELECT p.id, p.value, p.name, p.description, p.endpoint, p.key, COALESCE(p.active, true) AS active, COALESCE(p.generated, false) AS generated
    FROM providers_resource p
    WHERE (search IS NULL OR search = '' OR LOWER(p.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(p.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
    ORDER BY p.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
