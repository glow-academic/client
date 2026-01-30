-- Get scenario time limits for a simulation
-- Returns scenario time limit values for scenarios in a simulation
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_time_limits_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_time_limits_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop type if exists
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_scenario_time_limits_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario time limit items
CREATE TYPE types.q_get_scenario_time_limits_v4_item AS (
    id uuid,
    scenario_id uuid,
    time_limit_seconds integer,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_time_limits_v4(
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
time_limit_data AS (
    SELECT
        stlr.id,
        stlr.scenario_id,
        stlr.time_limit_seconds,
        COALESCE(sstlj.generated, false) as generated
    FROM params p
    JOIN simulation_scenario_time_limits_junction sstlj ON sstlj.simulation_id = p.sim_id
    JOIN scenario_time_limits_resource stlr ON stlr.id = sstlj.scenario_time_limit_id
    WHERE sstlj.active = true
      AND (COALESCE(array_length(p.scen_ids, 1), 0) = 0 OR stlr.scenario_id = ANY(p.scen_ids))
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (tld.id, tld.scenario_id, tld.time_limit_seconds, tld.generated)::types.q_get_scenario_time_limits_v4_item
            ORDER BY tld.time_limit_seconds, tld.scenario_id
        ) FROM time_limit_data tld),
        '{}'::types.q_get_scenario_time_limits_v4_item[]
    ) as items;
$$;
