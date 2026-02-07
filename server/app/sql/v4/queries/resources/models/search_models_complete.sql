-- Search models resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of model resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_models_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_models_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_models_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_models_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.active, q.generated)::types.q_get_models_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_models_v4_item[]
) as items
FROM (
    SELECT m.id, m.name, m.description, COALESCE(m.active, true) AS active, COALESCE(m.generated, false) AS generated
    FROM models_resource m
    WHERE m.name IS NOT NULL
      AND m.name != ''
      -- Only active models
      AND m.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(m.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (m.id = ANY(exclude_ids)))
    ORDER BY m.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
