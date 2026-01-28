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

CREATE OR REPLACE FUNCTION api_search_simulation_positions_v4(
    simulation_id uuid DEFAULT NULL,
    limit_count int DEFAULT 20,
    offset_count int DEFAULT 0,
    exclude_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_positions_v4_item[]
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
-- All active simulation positions with filtering
position_data AS (
    SELECT
        spr.id,
        spr.simulation_id,
        spr.value,
        COALESCE(spr.generated, false) as generated,
        COALESCE(spr.mcp, false) as mcp
    FROM simulation_positions_resource spr
    CROSS JOIN params p
    WHERE spr.active = true
    -- Filter by simulation_id if provided
    AND (p.sim_id IS NULL OR spr.simulation_id = p.sim_id)
    -- Exclude specified IDs
    AND NOT spr.id = ANY(p.exclude_ids)
    ORDER BY spr.value, spr.simulation_id
    LIMIT p.limit_val
    OFFSET p.offset_val
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.simulation_id, pd.value, pd.generated, pd.mcp)::types.q_get_simulation_positions_v4_item
            ORDER BY pd.value, pd.simulation_id
        ) FROM position_data pd),
        '{}'::types.q_get_simulation_positions_v4_item[]
    ) as items;
$$;
