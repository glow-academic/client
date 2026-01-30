-- Search available scenario flags for scenarios
-- Returns available flags that can be toggled for scenarios in a simulation
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

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
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_flags_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
-- Get all available flags for the given scenarios (from scenario_flags_resource)
-- If scenario_ids is empty, return flags for ALL active scenarios
available_flags AS (
    SELECT
        sfr.id,
        sfr.scenario_id,
        sfr.flag_id,
        f.name,
        COALESCE(f.description, '') as description,
        f.icon,
        COALESCE(sfr.generated, false) as generated
    FROM params p
    JOIN scenario_flags_resource sfr ON sfr.active = true
    JOIN flags_resource f ON f.id = sfr.flag_id
    JOIN scenarios_resource sr ON sr.id = sfr.scenario_id AND sr.active = true
    WHERE
        -- If scenario_ids provided, filter to those
        (array_length(p.scen_ids, 1) IS NOT NULL AND sfr.scenario_id = ANY(p.scen_ids))
        OR
        -- If scenario_ids empty, return all
        (array_length(p.scen_ids, 1) IS NULL)
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (af.id, af.scenario_id, af.flag_id, af.name, af.description, af.icon, af.generated)::types.q_get_scenario_flags_v4_item
            ORDER BY af.name, af.scenario_id
        ) FROM available_flags af),
        '{}'::types.q_get_scenario_flags_v4_item[]
    ) as items;
$$;
