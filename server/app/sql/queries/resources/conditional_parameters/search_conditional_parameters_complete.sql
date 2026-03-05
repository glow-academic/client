-- Search conditional_parameters resources with optional context
-- Parameters: search (text), limit_count (int), offset_count (int), exclude_ids (uuid[])
-- Returns: items (array of conditional parameter resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_conditional_parameters_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_conditional_parameters_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION api_search_conditional_parameters_v4(
    search text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    field boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_conditional_parameters_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.parameter_id, q.generated)::types.q_get_conditional_parameters_v4_item
        ORDER BY q.id
    ),
    ARRAY[]::types.q_get_conditional_parameters_v4_item[]
) as items
FROM (
    SELECT cp.id, cp.parameter_id, COALESCE(cp.generated, false) AS generated
    FROM conditional_parameters_resource cp
    WHERE cp.active = true
      -- No text search fields - search param accepted but not used
      -- Exclude filter
      AND (exclude_ids IS NULL OR NOT (cp.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT field OR EXISTS (SELECT 1 FROM field_conditional_parameters_junction j WHERE j.conditional_parameters_id = cp.id AND j.active = true))
    ORDER BY cp.id
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
