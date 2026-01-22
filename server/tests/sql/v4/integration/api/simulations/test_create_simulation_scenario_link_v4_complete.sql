-- Create simulation-scenario link for test setup
-- Returns link data for verification
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_simulation_scenario_link_v4(uuid, uuid, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_simulation_scenario_link_v4(
    input_simulation_id uuid,
    input_scenario_id uuid,
    input_position integer DEFAULT 1
)
RETURNS TABLE (
    simulation_id uuid,
    scenario_id uuid,
    active boolean,
    "position" integer,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH inserted_link AS (
        INSERT INTO simulation_scenarios_junction(simulation_id, scenario_id)
        VALUES (
            test_create_simulation_scenario_link_v4.input_simulation_id,
            test_create_simulation_scenario_link_v4.input_scenario_id
        )
        RETURNING simulation_id, scenario_id, created_at
    ),
    inserted_flag_resource AS (
        -- First ensure scenario_flags_resource exists for this scenario
        INSERT INTO scenario_flags_resource (scenario_id, flag_id, created_at, updated_at, generated, mcp, active, call_id)
        SELECT DISTINCT
            il.scenario_id,
            sf.id,
            NOW(),
            NOW(),
            false,
            false,
            true,
            (SELECT id FROM calls_entry LIMIT 1)
        FROM inserted_link il
        CROSS JOIN flags_resource sf
        WHERE sf.name = 'active'
        ON CONFLICT (scenario_id, flag_id) DO NOTHING
        RETURNING id, scenario_id
    ),
    inserted_flag AS (
        -- Then link simulation to scenario_flag via simulation_scenario_flags_junction
        INSERT INTO simulation_scenario_flags_junction (simulation_id, scenario_flag_id, value, created_at, updated_at, generated, mcp, active)
        SELECT 
            il.simulation_id,
            ifr.id,
            true,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM inserted_link il
        JOIN inserted_flag_resource ifr ON ifr.scenario_id = il.scenario_id
    ),
    inserted_position_resource AS (
        -- First ensure scenario_positions_resource exists for this scenario+position
        INSERT INTO scenario_positions_resource(scenario_id, value, created_at, updated_at, generated, mcp, call_id)
        SELECT 
            il.scenario_id,
            COALESCE(test_create_simulation_scenario_link_v4.input_position, 1),
            NOW(),
            NOW(),
            false,
            false,
            (SELECT id FROM calls_entry LIMIT 1)
        FROM inserted_link il
        ON CONFLICT (scenario_id, value) DO NOTHING
        RETURNING id, scenario_id, value
    ),
    inserted_position AS (
        -- Then link simulation to scenario_position via simulation_scenario_positions_junction
        INSERT INTO simulation_scenario_positions_junction (simulation_id, scenario_position_id, created_at, updated_at, generated, mcp, active)
        SELECT 
            il.simulation_id,
            ipr.id,
            NOW(),
            NOW(),
            false,
            false,
            true
        FROM inserted_link il
        JOIN inserted_position_resource ipr ON ipr.scenario_id = il.scenario_id
    )
    SELECT 
        il.simulation_id,
        il.scenario_id,
        true as active,
        COALESCE(test_create_simulation_scenario_link_v4.input_position, 1) as "position",
        il.created_at
    FROM inserted_link il;
$$;