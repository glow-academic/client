-- Search problem statements resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of problem statement resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_problem_statements_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_problem_statements_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_problem_statements_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_problem_statements_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            ps.id,
            ps.name,
            ps.problem_statement,
            COALESCE(ps.generated, false)
        )::types.q_get_problem_statements_v4_item
        ORDER BY ps.name
    ),
    ARRAY[]::types.q_get_problem_statements_v4_item[]
) as items
FROM problem_statements_resource ps
WHERE ps.active = true
  AND (exclude_ids IS NULL OR NOT (ps.id = ANY(exclude_ids)))
  AND (search IS NULL OR search = '' OR LOWER(ps.name) LIKE '%' || LOWER(search) || '%' OR LOWER(ps.problem_statement) LIKE '%' || LOWER(search) || '%')
LIMIT limit_count
OFFSET offset_count;
$$;
