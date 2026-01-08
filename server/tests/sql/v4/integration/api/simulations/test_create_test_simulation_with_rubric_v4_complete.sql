-- Create a test simulation with rubric for test setup
-- Returns simulation_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_simulation_with_rubric_v4(uuid, text, text, boolean, boolean, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_simulation_with_rubric_v4(
    rubric_id uuid,
    title text DEFAULT 'Test Simulation',
    description text DEFAULT 'Test Description',
    active boolean DEFAULT true,
    practice_simulation boolean DEFAULT false,
    time_limit integer DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    time_limit integer,
    rubric_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_simulation AS (
        INSERT INTO simulations DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (COALESCE(test_create_test_simulation_with_rubric_v4.title, 'Test Simulation'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions(description)
        VALUES (COALESCE(test_create_test_simulation_with_rubric_v4.description, 'Test Description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags WHERE name = 'active' LIMIT 1
    ),
    practice_flag AS (
        SELECT id FROM flags WHERE name = 'practice' LIMIT 1
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
    simulation_active_flag_link AS (
        INSERT INTO simulation_flags(simulation_id, flag_id, type, value)
        SELECT ns.id, af.id, 'active'::type_simulation_flags, COALESCE(test_create_test_simulation_with_rubric_v4.active, true)
        FROM new_simulation ns, active_flag af
        RETURNING simulation_id
    ),
    simulation_practice_flag_link AS (
        INSERT INTO simulation_flags(simulation_id, flag_id, type, value)
        SELECT ns.id, pf.id, 'practice'::type_simulation_flags, COALESCE(test_create_test_simulation_with_rubric_v4.practice_simulation, false)
        FROM new_simulation ns, practice_flag pf
        RETURNING simulation_id
    )
    SELECT 
        ns.id as simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = ns.id LIMIT 1) as title,
        (SELECT d.description FROM simulation_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.simulation_id = ns.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = ns.id AND fl.name = 'active' AND sf.type = 'active'::type_simulation_flags AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = ns.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        test_create_test_simulation_with_rubric_v4.time_limit,
        test_create_test_simulation_with_rubric_v4.rubric_id as rubric_id,
        ns.created_at
    FROM new_simulation ns;
$$;