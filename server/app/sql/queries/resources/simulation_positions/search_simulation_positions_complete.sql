-- Search simulation positions
-- Returns simulation position details with optional filtering

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_simulation_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_simulation_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists (only drop this specific type)
DROP TYPE IF EXISTS types.q_search_simulation_positions_v4_item CASCADE;

-- Create composite type for simulation position items
CREATE TYPE types.q_search_simulation_positions_v4_item AS (
    id uuid,
    simulation_id uuid,
    value integer,
    generated boolean,
    mcp boolean
);

CREATE OR REPLACE FUNCTION api_search_simulation_positions_v4(
    simulation_ids uuid[] DEFAULT ARRAY[]::uuid[],
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    cohort boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_search_simulation_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH
-- All simulation positions with filtering
position_data AS (
    SELECT
        spr.id,
        spr.simulation_id,
        spr.value,
        COALESCE(spr.generated, false) as generated,
        COALESCE(spr.mcp, false) as mcp
    FROM simulation_positions_resource spr
    -- Filter by simulation_ids if provided
    WHERE (COALESCE(array_length(simulation_ids, 1), 0) = 0 OR spr.simulation_id = ANY(simulation_ids))
    -- Exclude specified IDs
    AND (exclude_ids IS NULL OR NOT (spr.id = ANY(exclude_ids)))
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_simulation_positions_junction j WHERE j.simulation_positions_id = spr.id AND j.active = true))
    ORDER BY spr.value, spr.simulation_id
)
SELECT COALESCE(
    ARRAY_AGG(
        (q.id, q.simulation_id, q.value, q.generated, q.mcp)::types.q_search_simulation_positions_v4_item
        ORDER BY q.value, q.simulation_id
    ),
    ARRAY[]::types.q_search_simulation_positions_v4_item[]
) as items
FROM (
    SELECT * FROM position_data
    LIMIT limit_count
    OFFSET offset_count
) q;
$$;
