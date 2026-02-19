-- Search simulation availability
-- Returns simulation availability details with optional filtering

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_simulation_availability_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulation_availability_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_simulation_availability_v4_item

CREATE OR REPLACE FUNCTION api_search_simulation_availability_v4(
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    availability_type text DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters
    cohort boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_simulation_availability_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH availability_data AS (
    SELECT
        sar.id,
        sar.simulation_id,
        sar.time,
        sar.type::text as type,
        COALESCE(sar.generated, false) as generated,
        COALESCE(sar.mcp, false) as mcp
    FROM simulation_availability_resource sar
    WHERE sar.active = true
      AND (COALESCE(array_length(simulation_ids, 1), 0) = 0 OR sar.simulation_id = ANY(simulation_ids))
      AND (availability_type IS NULL OR sar.type::text = availability_type)
      AND (exclude_ids IS NULL OR NOT (sar.id = ANY(exclude_ids)))
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_simulation_availability_junction j WHERE j.simulation_availability_id = sar.id AND j.active = true))
    ORDER BY sar.simulation_id, sar.type
)
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.simulation_id, q.time, q.type, q.generated, q.mcp)::types.q_get_simulation_availability_v4_item
        ORDER BY q.simulation_id, q.type
    ),
    ARRAY[]::types.q_get_simulation_availability_v4_item[]
) as items
FROM (
    SELECT * FROM availability_data
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
