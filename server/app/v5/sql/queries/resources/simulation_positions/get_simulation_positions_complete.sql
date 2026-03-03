-- Get simulation positions by simulation IDs
-- Returns simulation position details for the given simulation IDs

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_simulation_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists (only drop this specific type, not with pattern match)
DROP TYPE IF EXISTS types.q_get_simulation_positions_v4_get_item CASCADE;

-- Create composite type for simulation position items
CREATE TYPE types.q_get_simulation_positions_v4_get_item AS (
    id uuid,
    simulation_id uuid,
    value integer,
    generated boolean,
    mcp boolean
);

CREATE OR REPLACE FUNCTION api_get_simulation_positions_v4(
    simulation_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_positions_v4_get_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH position_data AS (
    SELECT
        spr.id,
        spr.simulation_id,
        spr.value,
        COALESCE(spr.generated, false) as generated,
        COALESCE(spr.mcp, false) as mcp
    FROM simulation_positions_resource spr
    WHERE spr.simulation_id = ANY(simulation_ids)
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.simulation_id, pd.value, pd.generated, pd.mcp)::types.q_get_simulation_positions_v4_get_item
            ORDER BY pd.value, pd.simulation_id
        ) FROM position_data pd),
        '{}'::types.q_get_simulation_positions_v4_get_item[]
    ) as items;
$$;
