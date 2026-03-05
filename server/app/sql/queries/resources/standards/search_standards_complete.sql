-- Search standards resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of standards resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_standards_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_standards_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_standards_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    standard_group_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    rubric boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_standards_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.standard_id, q.standard_groups_id, q.name, q.description, q.points)::types.q_get_standards_v4_item
        ORDER BY q.name, q.standard_id
    ),
    ARRAY[]::types.q_get_standards_v4_item[]
) as items
FROM (
    SELECT
        r.id AS standard_id,
        r.standard_groups_id,
        r.name,
        COALESCE(r.description, '') AS description,
        COALESCE(r.points, 0)::float AS points
    FROM standards_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(r.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(standard_group_ids, 1), 0) = 0 OR r.standard_groups_id = ANY(standard_group_ids))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_standards_junction j WHERE j.standards_id = r.id AND j.active = true))
    ORDER BY r.name, r.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
