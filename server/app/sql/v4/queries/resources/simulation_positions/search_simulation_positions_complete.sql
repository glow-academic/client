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
    simulation_id uuid DEFAULT NULL,
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
WITH params AS (
    SELECT
        simulation_id AS sim_id,
        COALESCE(limit_count, 20) AS limit_val,
        COALESCE(offset_count, 0) AS offset_val,
        COALESCE(exclude_ids, ARRAY[]::uuid[]) AS exclude_ids
),
-- All simulation positions with filtering
position_data AS (
    SELECT
        spr.id,
        spr.simulation_id,
        spr.value,
        COALESCE(spr.generated, false) as generated,
        COALESCE(spr.mcp, false) as mcp
    FROM simulation_positions_resource spr
    CROSS JOIN params p
    -- Filter by simulation_id if provided
    WHERE (p.sim_id IS NULL OR spr.simulation_id = p.sim_id)
    -- Exclude specified IDs
    AND NOT spr.id = ANY(p.exclude_ids)
      -- Artifact boolean filters (each filters to resources linked to at least one of that artifact type)
      AND (NOT cohort OR EXISTS (SELECT 1 FROM cohort_simulation_positions_junction j WHERE j.simulation_position_id = spr.id AND j.active = true))
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
