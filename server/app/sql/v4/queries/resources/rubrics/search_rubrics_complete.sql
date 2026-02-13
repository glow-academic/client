-- Search rubrics resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of rubrics resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_rubrics_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    simulation_rubric boolean DEFAULT NULL,
    video_rubric boolean DEFAULT NULL,
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    rubric boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.name, q.description)::types.q_get_rubrics_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_rubrics_v4_item[]
) as items
FROM (
    SELECT
        r.id,
        COALESCE(r.name, '') AS name,
        COALESCE(r.description, '') AS description
    FROM rubrics_resource r
    WHERE r.active = true
      AND (search IS NULL OR search = '' OR LOWER(r.name) LIKE '%' || LOWER(search) || '%' OR LOWER(COALESCE(r.description, '')) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR r.department_ids && department_ids)
      AND (simulation_rubric IS NULL OR r.simulation_rubric = simulation_rubric)
      AND (video_rubric IS NULL OR r.video_rubric = video_rubric)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT rubric OR EXISTS (SELECT 1 FROM rubric_rubrics_junction j WHERE j.rubric_id = r.id AND j.active = true))
    ORDER BY r.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
