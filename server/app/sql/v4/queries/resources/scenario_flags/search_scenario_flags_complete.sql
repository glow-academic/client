-- Search available scenario flags for scenarios
-- Returns available flags from scenario_flags_resource
-- Parameters: scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_flags_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_flags_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_flags_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_flags_v4(
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[],
    -- Artifact boolean filters: when true, only return resources linked to that artifact type
    simulation boolean DEFAULT false
)
RETURNS TABLE (
    items types.q_get_scenario_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT
    COALESCE(
        ARRAY_AGG(
            (sfr.id, sfr.scenario_id, sfr.flag_id, f.name, COALESCE(f.description, ''), COALESCE(f.icon, ''), COALESCE(sfr.generated, false))::types.q_get_scenario_flags_v4_item
            ORDER BY f.name, sfr.scenario_id
        ),
        '{}'::types.q_get_scenario_flags_v4_item[]
    ) as items
FROM scenario_flags_resource sfr
JOIN flags_resource f ON f.id = sfr.flag_id AND f.active = true
WHERE sfr.active = true
  AND (
    COALESCE(array_length(scenario_ids, 1), 0) = 0
    OR sfr.scenario_id = ANY(scenario_ids)
  )
  -- Artifact boolean filters
  AND (NOT simulation OR EXISTS (SELECT 1 FROM simulation_scenario_flags_junction j WHERE j.scenario_flag_id = sfr.id AND j.active = true));
$$;
