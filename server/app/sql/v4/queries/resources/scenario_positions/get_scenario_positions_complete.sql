-- Get scenario positions for a simulation
-- Returns scenario position values for scenarios in a simulation
-- Parameters: simulation_id (uuid), scenario_ids (uuid[])

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_scenario_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_scenario_positions_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_scenario_positions_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for scenario position items
CREATE TYPE types.q_get_scenario_positions_v4_item AS (
    id uuid,
    simulation_id uuid,
    scenario_id uuid,
    value integer,
    generated boolean
);

CREATE OR REPLACE FUNCTION api_get_scenario_positions_v4(
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
position_data AS (
    SELECT
        spr.id,
        sspj.simulation_id,
        spr.scenario_id,
        spr.value,
        COALESCE(sspj.generated, false) as generated
    FROM params p
    JOIN simulation_scenario_positions_junction sspj ON sspj.simulation_id = p.sim_id
    JOIN scenario_positions_resource spr ON spr.id = sspj.scenario_position_id
    WHERE sspj.active = true
      AND (COALESCE(array_length(p.scen_ids, 1), 0) = 0 OR spr.scenario_id = ANY(p.scen_ids))
)
SELECT
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.id, pd.simulation_id, pd.scenario_id, pd.value, pd.generated)::types.q_get_scenario_positions_v4_item
            ORDER BY pd.value, pd.scenario_id
        ) FROM position_data pd),
        '{}'::types.q_get_scenario_positions_v4_item[]
    ) as items;
$$;
