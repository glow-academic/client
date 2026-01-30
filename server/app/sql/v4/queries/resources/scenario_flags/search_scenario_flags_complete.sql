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
-- Get all available flags for the given scenarios from resource_flags_relation
-- This table links scenarios to their available flag types
-- If scenario_ids is empty, return flags for ALL scenarios
available_flags AS (
    SELECT
        -- Use flag_id as the id (since resource_flags_relation doesn't have its own id)
        f.id as id,
        rfr.resource_id as scenario_id,
        f.id as flag_id,
        f.name,
        COALESCE(f.description, '') as description,
        COALESCE(f.icon, '') as icon,
        false as generated
    FROM params p
    JOIN resource_flags_relation rfr ON true
    JOIN flags_resource f ON f.type = rfr.flag_type AND f.active = true
    JOIN scenarios_resource sr ON sr.id = rfr.resource_id AND sr.active = true
    WHERE
        -- If scenario_ids is empty, return all
        COALESCE(array_length(p.scen_ids, 1), 0) = 0
        OR
        -- Otherwise filter to provided scenario_ids
        rfr.resource_id = ANY(p.scen_ids)
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
