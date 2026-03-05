-- Search thresholds resources
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of threshold resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_thresholds_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_thresholds_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_thresholds_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    setting boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_thresholds_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.value, q.generated)::types.q_get_thresholds_v4_item
        ORDER BY q.value
    ),
    ARRAY[]::types.q_get_thresholds_v4_item[]
) as items
FROM (
    SELECT r.id, r.value, COALESCE(r.generated, false) AS generated
    FROM thresholds_resource r
    WHERE r.active = true
      AND (exclude_ids IS NULL OR NOT (r.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT setting OR EXISTS (SELECT 1 FROM setting_thresholds_junction j WHERE j.thresholds_id = r.id AND j.active = true))
    ORDER BY r.value
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
