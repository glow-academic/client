-- Search cohorts resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of cohort resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_cohorts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_cohorts_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function - query cohorts_resource directly (department_ids denormalized)
CREATE OR REPLACE FUNCTION api_search_cohorts_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    cohort boolean DEFAULT false,
    profile boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_cohorts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            q.id,
            q.name,
            q.description,
            q.active,
            q.department_ids
        )::types.q_get_cohorts_v4_item
        ORDER BY q.name
    ),
    ARRAY[]::types.q_get_cohorts_v4_item[]
) as items
FROM (
    SELECT
        cr.id,
        COALESCE(cr.name, '') AS name,
        COALESCE(cr.description, '') AS description,
        cr.active,
        COALESCE(
            (SELECT ARRAY_AGG(d::text) FROM unnest(cr.department_ids) d),
            ARRAY[]::text[]
        ) AS department_ids
    FROM cohorts_resource cr
    WHERE cr.active = true
      AND (search IS NULL OR search = '' OR LOWER(cr.name) LIKE '%' || LOWER(search) || '%')
      AND (exclude_ids IS NULL OR NOT (cr.id = ANY(exclude_ids)))
      AND (COALESCE(array_length(department_ids, 1), 0) = 0 OR cr.department_ids && department_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_cohorts_junction j WHERE j.cohort_id = cr.id AND j.active = true))
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_cohorts_junction j WHERE j.cohort_id = cr.id AND j.active = true))
    ORDER BY cr.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
