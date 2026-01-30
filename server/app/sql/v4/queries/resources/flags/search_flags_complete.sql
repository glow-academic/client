-- Search flags resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[]), artifact_type (text)
-- Returns: items (array of flag resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_flags_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    artifact_type text DEFAULT NULL
)
RETURNS TABLE (
    items types.q_get_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description, q.icon, q.generated)::types.q_get_flags_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_flags_v4_item[]
) as items
FROM (
    SELECT f.id, f.name, f.description, f.icon, COALESCE(f.generated, false) AS generated
    FROM flags_resource f
    WHERE (search IS NULL OR search = '' OR LOWER(f.name) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (f.id = ANY(exclude_ids)))
      AND (artifact_type IS NULL OR (
          EXISTS (
              SELECT 1 FROM artifact_flags_relation afr
              WHERE afr.artifact = artifact_type::artifact_type
                AND afr.flag_type = f.type
          )
      ))
    ORDER BY f.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
