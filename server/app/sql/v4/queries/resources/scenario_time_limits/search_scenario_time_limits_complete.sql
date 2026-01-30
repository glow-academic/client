-- Search available scenario time limits for scenarios
-- Returns available time limits that can be set for scenarios
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_scenario_time_limits_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_scenario_time_limits_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Reuses type from get endpoint: types.q_get_scenario_time_limits_v4_item

CREATE OR REPLACE FUNCTION api_search_scenario_time_limits_v4(
    simulation_id uuid,
    scenario_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_scenario_time_limits_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT simulation_id AS sim_id, scenario_ids AS scen_ids
),
-- Get all available time limits for the given scenarios
available_time_limits AS (
    SELECT
        stlr.id,
        stlr.scenario_id,
        stlr.time_limit_seconds,
        COALESCE(stlr.generated, false) as generated
    FROM params p
    CROSS JOIN LATERAL unnest(p.scen_ids) AS sid
    JOIN scenario_time_limits_resource stlr ON stlr.scenario_id = sid AND stlr.active = true
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (atl.id, atl.scenario_id, atl.time_limit_seconds, atl.generated)::types.q_get_scenario_time_limits_v4_item
            ORDER BY atl.time_limit_seconds, atl.scenario_id
        ) FROM available_time_limits atl),
        '{}'::types.q_get_scenario_time_limits_v4_item[]
    ) as items;
$$;
