-- Create a test simulation linked to a rubric for test setup
-- Returns simulation data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_simulation_with_rubric_v4(uuid, text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_simulation_with_rubric_v4(
    input_rubric_id uuid,
    simulation_name text DEFAULT 'Test Simulation',
    simulation_description text DEFAULT 'Test Description',
    simulation_active boolean DEFAULT true
)
RETURNS TABLE (
    simulation_id uuid,
    name text,
    description text,
    active boolean,
    rubric_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_simulation AS (
        INSERT INTO simulations_resource DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (COALESCE(simulation_name, 'Test Simulation'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(simulation_description, 'Test Description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    simulation_name_link AS (
        INSERT INTO simulation_names(simulation_id, name_id)
        SELECT ns.id, nr.id
        FROM new_simulation ns, name_resource nr
        RETURNING simulation_id
    ),
    simulation_description_link AS (
        INSERT INTO simulation_descriptions(simulation_id, description_id)
        SELECT ns.id, dr.id
        FROM new_simulation ns, description_resource dr
        RETURNING simulation_id
    ),
    simulation_flag_link AS (
        INSERT INTO simulation_flags(simulation_id, flag_id, type, value)
        SELECT ns.id, af.id, 'active'::type_simulation_flags, simulation_active
        FROM new_simulation ns, active_flag af
        RETURNING simulation_id
    )
    SELECT 
        ns.id AS simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = ns.id LIMIT 1) AS name,
        (SELECT d.description FROM simulation_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.simulation_id = ns.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.simulation_id = ns.id AND fl.name = 'active' AND sf.type = 'active'::type_simulation_flags AND sf.value = TRUE) AS active,
        NULL::uuid AS rubric_id,
        ns.created_at
    FROM new_simulation ns;
$$;