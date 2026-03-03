-- Search request_limits resources
-- Small set - simple active filter + order by requests_per_day
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of request_limit resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_request_limits_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_request_limits_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_request_limits_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    profile boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_request_limits_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.requests_per_day, q.generated)::types.q_get_request_limits_v4_item
        ORDER BY q.requests_per_day
    ),
    ARRAY[]::types.q_get_request_limits_v4_item[]
) as items
FROM (
    SELECT r.id, r.requests_per_day, COALESCE(r.generated, false) AS generated
    FROM request_limits_resource r
    WHERE r.active = true
      -- Search filter (search by stringified requests_per_day)
      AND (search IS NULL OR search = '' OR r.requests_per_day::text LIKE '%' || search || '%')
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT profile OR EXISTS (SELECT 1 FROM profile_request_limits_junction j WHERE j.request_limit_id = r.id AND j.active = true))
    ORDER BY r.requests_per_day
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
