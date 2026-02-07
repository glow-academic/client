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

-- Create function
CREATE OR REPLACE FUNCTION api_search_cohorts_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_cohorts_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH cohort_deps AS (
    SELECT
        cam.resource_id,
        ARRAY_AGG(cd.department_id::text ORDER BY cd.created_at) as department_ids
    FROM cohort_cohorts_junction ccj
    JOIN cohort_departments_junction cd ON cd.cohort_id = ccj.cohort_id AND cd.active = true
    JOIN (
        SELECT ccj2.cohorts_id AS resource_id, ccj2.cohort_id
        FROM cohort_cohorts_junction ccj2
        WHERE ccj2.active = true
    ) cam ON cam.cohort_id = ccj.cohort_id AND cam.resource_id = ccj.cohorts_id
    WHERE ccj.active = true
    GROUP BY cam.resource_id
)
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
        COALESCE(cdd.department_ids, ARRAY[]::text[]) AS department_ids
    FROM cohorts_resource cr
    LEFT JOIN cohort_deps cdd ON cdd.resource_id = cr.id
    WHERE cr.active = true
      -- Search filter
      AND (search IS NULL OR search = '' OR LOWER(cr.name) LIKE '%' || LOWER(search) || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (cr.id = ANY(exclude_ids)))
    ORDER BY cr.name
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
