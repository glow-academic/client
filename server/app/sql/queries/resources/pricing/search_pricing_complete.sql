-- Search pricing resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of pricing resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_pricing_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_pricing_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_pricing_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    pricing_type text DEFAULT NULL,
    unit_names text[] DEFAULT ARRAY[]::text[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    model boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_pricing_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.pricing_type, q.price, q.unit_name, q.unit_category, q.unit_value, q.generated)::types.q_get_pricing_v4_item
        ORDER BY q.id
    ),
    ARRAY[]::types.q_get_pricing_v4_item[]
) as items
FROM (
    SELECT p.id, p.pricing_type::text, p.price, p.unit_name, p.unit_category::text, p.unit_value, COALESCE(p.generated, false) AS generated
    FROM pricing_resource p
    WHERE p.active = true
      AND (search IS NULL OR search = '' OR LOWER(p.pricing_type::text) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (p.id = ANY(exclude_ids)))
      AND (api_search_pricing_v4.pricing_type IS NULL OR p.pricing_type::text = api_search_pricing_v4.pricing_type)
      AND (COALESCE(array_length(unit_names, 1), 0) = 0 OR p.unit_name = ANY(unit_names))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT model OR EXISTS (SELECT 1 FROM model_pricing_junction j WHERE j.pricing_id = p.id AND j.active = true))
    ORDER BY p.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
