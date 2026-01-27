-- Search colors resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), group_id (uuid, optional), exclude_ids (uuid[])
-- Returns: items (array of color resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_colors_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_colors_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    group_id uuid DEFAULT NULL,
    use_recent boolean DEFAULT false,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_colors_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.hex_code, q.generated)::types.q_get_colors_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_colors_v4_item[]
) as items
FROM (
    SELECT c.id, c.name, c.description, c.hex_code, COALESCE(c.generated, false) AS generated, recent.recent_at
    FROM colors_resource c
    LEFT JOIN LATERAL (
        SELECT MAX(pc.created_at) AS recent_at
        FROM persona_colors_junction pc
        WHERE use_recent = true
          AND pc.color_id = c.id
    ) recent ON true
    WHERE c.active = true
      AND (search IS NULL OR search = '' OR
           LOWER(c.name) LIKE '%' || LOWER(search) || '%' OR
           LOWER(c.hex_code) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (c.id = ANY(exclude_ids)))
      AND (
          COALESCE(c.generated, false) = false
          OR (
              COALESCE(c.generated, false) = true
              AND group_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM view_calls_entry c2
                  JOIN view_runs_entry r ON r.id = c2.run_id
                  WHERE c2.id IN (SELECT call_id FROM colors_calls_connection WHERE colors_id = c.id)
                    AND r.group_id = group_id
              )
          )
      )
    ORDER BY
        CASE WHEN use_recent THEN recent.recent_at END DESC NULLS LAST,
        c.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
