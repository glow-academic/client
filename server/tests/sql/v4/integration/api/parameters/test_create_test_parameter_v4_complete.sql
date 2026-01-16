-- Create a test parameter for test setup
-- Returns parameter data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_parameter_v4(text, text, boolean, boolean, boolean, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_parameter_v4(
    parameter_name text,
    parameter_description text DEFAULT 'Test parameter description',
    parameter_active boolean DEFAULT true,
    parameter_document_parameter boolean DEFAULT false,
    parameter_simulation_parameter boolean DEFAULT false
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
VOLATILE
AS $$
    WITH new_parameter AS (
        INSERT INTO parameters_resource DEFAULT VALUES
        RETURNING id, created_at, updated_at
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (parameter_name)
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(parameter_description, 'Test parameter description'))
        RETURNING id
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    document_parameter_flag AS (
        SELECT id FROM flags_resource WHERE name = 'document_parameter' LIMIT 1
    ),
    simulation_parameter_flag AS (
        SELECT id FROM flags_resource WHERE name = 'simulation_parameter' LIMIT 1
    ),
    parameter_name_link AS (
        INSERT INTO parameter_names(parameter_id, name_id)
        SELECT np.id, nr.id
        FROM new_parameter np, name_resource nr
        RETURNING parameter_id
    ),
    parameter_description_link AS (
        INSERT INTO parameter_descriptions(parameter_id, description_id)
        SELECT np.id, dr.id
        FROM new_parameter np, description_resource dr
        RETURNING parameter_id
    ),
    parameter_active_flag_link AS (
        INSERT INTO parameter_flags (parameter_id, flag_id, value)
        SELECT np.id, af.id, COALESCE(parameter_active, true)
        FROM new_parameter np, active_flag af
        RETURNING parameter_id
    ),
    parameter_document_flag_link AS (
        INSERT INTO parameter_flags (parameter_id, flag_id, value)
        SELECT np.id, dpf.id, COALESCE(parameter_document_parameter, false)
        FROM new_parameter np, document_parameter_flag dpf
        WHERE COALESCE(parameter_document_parameter, false) = true
        RETURNING parameter_id
    ),
    parameter_simulation_flag_link AS (
        INSERT INTO parameter_flags (parameter_id, flag_id, value)
        SELECT np.id, spf.id, COALESCE(parameter_simulation_parameter, false)
        FROM new_parameter np, simulation_parameter_flag spf
        WHERE COALESCE(parameter_simulation_parameter, false) = true
        RETURNING parameter_id
    )
    SELECT 
        np.id AS parameter_id,
        (SELECT n.name FROM parameter_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = np.id LIMIT 1) AS name,
        (SELECT d.description FROM parameter_descriptions pd JOIN descriptions_resource d ON pd.description_id = d.id WHERE pd.parameter_id = np.id LIMIT 1) AS description,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = np.id AND fl.name = 'active'  AND pf.value = TRUE) AS active,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = np.id AND fl.name = 'document_parameter'  AND pf.value = TRUE) AS document_parameter,
        EXISTS (SELECT 1 FROM parameter_flags pf JOIN flags_resource fl ON pf.flag_id = fl.id WHERE pf.parameter_id = np.id AND fl.name = 'simulation_parameter'  AND pf.value = TRUE) AS simulation_parameter,
        np.created_at,
        np.updated_at
    FROM new_parameter np;
$$;