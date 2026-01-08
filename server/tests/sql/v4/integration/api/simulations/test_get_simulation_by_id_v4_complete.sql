-- Get simulation by ID for test verification
-- Returns simulation data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_by_id_v4(
    input_simulation_id uuid
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        s.id as simulation_id,
        (SELECT n.name FROM simulation_names sn JOIN names n ON sn.name_id = n.id WHERE sn.simulation_id = s.id LIMIT 1) as title,
        (SELECT d.description FROM simulation_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.simulation_id = s.id LIMIT 1) as description,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_simulation_flags AND sf.value = TRUE) as active,
        EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'practice' AND sf.type = 'practice'::type_simulation_flags AND sf.value = TRUE) as practice_simulation,
        s.created_at,
        s.updated_at
    FROM simulations s
    WHERE s.id = test_get_simulation_by_id_v4.input_simulation_id;
$$;