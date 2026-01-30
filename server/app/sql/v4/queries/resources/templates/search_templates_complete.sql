-- Search templates resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of template resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_templates_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_templates_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_templates_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_templates_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            t.id,
            t.name,
            COALESCE(t.description, ''),
            COALESCE(t.generated, false)
        )::types.q_get_templates_v4_item
        ORDER BY t.name
    ),
    ARRAY[]::types.q_get_templates_v4_item[]
) as items
FROM templates_resource t
WHERE t.active = true
  AND (exclude_ids IS NULL OR NOT (t.id = ANY(exclude_ids)))
  AND (search IS NULL OR search = '' OR LOWER(t.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(t.description, '')) LIKE '%' || LOWER(search) || '%')
LIMIT limit_count
OFFSET offset_count;
$$;
