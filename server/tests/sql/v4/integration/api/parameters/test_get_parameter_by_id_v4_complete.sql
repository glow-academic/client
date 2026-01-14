-- Get parameter by ID for test verification
-- Returns parameter details for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_parameter_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_parameter_by_id_v4(
    input_parameter_id uuid
)
RETURNS TABLE (
    parameter_id uuid,
    name text,
    description text,
    active boolean,
    document_parameter boolean,
    simulation_parameter boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        p.id AS parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = p.id LIMIT 1) AS name,
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = p.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_parameter_flags AND pf.value = TRUE) AS active,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'document_parameter' AND pf.type = 'document_parameter'::type_parameter_flags AND pf.value = TRUE) AS document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = p.id AND fl.name = 'simulation_parameter' AND pf.type = 'simulation_parameter'::type_parameter_flags AND pf.value = TRUE) AS simulation_parameter,
        p.created_at,
        p.updated_at
    FROM parameters_resource p
    WHERE p.id = input_parameter_id;
$$;