-- Search run_rubrics resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of run_rubrics resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_run_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_run_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_run_rubrics_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    eval boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_run_rubrics_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.runs_id, q.rubric_id, q.generated)::types.q_get_run_rubrics_v4_item
        ORDER BY q.id
    ),
    ARRAY[]::types.q_get_run_rubrics_v4_item[]
) as items
FROM (
    SELECT
        r.id,
        r.runs_id,
        r.rubric_id,
        COALESCE(r.generated, false) AS generated
    FROM run_rubrics_resource r
    WHERE r.active = true
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT eval OR EXISTS (SELECT 1 FROM eval_runs_rubrics_junction j WHERE j.run_rubric_id = r.id AND j.active = true))
    ORDER BY r.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
