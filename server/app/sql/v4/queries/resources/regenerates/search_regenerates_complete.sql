-- Search regenerates resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), suggest_source (text), exclude_ids (uuid[])
-- Returns: items (array of regenerate resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_regenerates_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_regenerates_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_regenerates_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    suggest_source text DEFAULT 'all',
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_regenerates_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.instructions, q.generated)::types.q_get_regenerates_v4_item
        ORDER BY q.instructions
    ),
    ARRAY[]::types.q_get_regenerates_v4_item[]
) as items
FROM (
    SELECT
        r.id,
        r.instructions,
        COALESCE(r.generated, false) AS generated
    FROM regenerates_resource r
    WHERE r.active = true
      AND r.instructions IS NOT NULL
      AND r.instructions != ''
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Search filter
      AND (
          search IS NULL
          OR search = ''
          OR LOWER(r.instructions) LIKE '%' || LOWER(search) || '%'
      )
    ORDER BY r.instructions
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
