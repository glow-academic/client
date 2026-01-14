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
        INSERT INTO simulation_scenarios(simulation_id, scenario_id)
        VALUES (
            test_create_simulation_scenario_link_v4.input_simulation_id,
            test_create_simulation_scenario_link_v4.input_scenario_id
        )
        RETURNING simulation_id, scenario_id, created_at
    ),
    inserted_flag AS (
        INSERT INTO simulation_scenario_flags_resource(simulation_id, scenario_id, scenario_flag_id, type, value, created_at, updated_at, generated, mcp)
        SELECT 
            il.simulation_id,
            il.scenario_id,
            sf.id,
            'active'::type_simulation_scenario_flags,
            true,
            NOW(),
            NOW(),
            false,
            false
        FROM inserted_link il
        CROSS JOIN flags_resource sf
        WHERE sf.name = 'active'
        LIMIT 1
    ),
    inserted_position AS (
        INSERT INTO scenario_positions_resource(simulation_id, scenario_id, value, created_at, updated_at, generated, mcp)
        SELECT 
            il.simulation_id,
            il.scenario_id,
            COALESCE(test_create_simulation_scenario_link_v4.input_position, 1),
            NOW(),
            NOW(),
            false,
            false
        FROM inserted_link il
    )
    SELECT 
        il.simulation_id,
        il.scenario_id,
        true as active,
        COALESCE(test_create_simulation_scenario_link_v4.input_position, 1) as "position",
        il.created_at
    FROM inserted_link il;
$$;