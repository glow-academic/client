-- Search available scenario positions for scenarios
-- Returns available positions that can be set for scenarios
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_positions_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_positions_v4(
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
-- Get all available positions for the given scenarios
available_positions AS (
    SELECT
        spr.id,
        p.sim_id as simulation_id,
        spr.scenario_id,
        spr.value,
        COALESCE(spr.generated, false) as generated
    FROM params p
    CROSS JOIN LATERAL unnest(p.scen_ids) AS sid
    JOIN scenario_positions_resource spr ON spr.scenario_id = sid
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (ap.id, ap.simulation_id, ap.scenario_id, ap.value, ap.generated)::types.q_get_scenario_positions_v4_item
            ORDER BY ap.value, ap.scenario_id
        ) FROM available_positions ap),
        '{}'::types.q_get_scenario_positions_v4_item[]
    ) as items;
$$;
