-- Search available scenario positions for scenarios
-- Returns available positions from scenario_positions_resource
-- Parameters: scenario_ids (uuid[])

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
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    simulation boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_scenario_positions_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (spr.id, spr.scenario_id, spr.value, COALESCE(spr.generated, false))::types.q_get_scenario_positions_v4_item
            ORDER BY spr.value, spr.scenario_id
        ),
        '{}'::types.q_get_scenario_positions_v4_item[]
    ) as items
FROM scenario_positions_resource spr
WHERE spr.active = true
  AND (
    COALESCE(array_length(scenario_ids, 1), 0) = 0
    OR spr.scenario_id = ANY(scenario_ids)
  )
  -- Artifact boolean filters
  AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_scenario_positions_junction j WHERE j.scenario_position_id = spr.id AND j.active = true));
$$;
