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
    INSERT INTO parameters(name, description, active, document_parameter, simulation_parameter)
    VALUES (
        parameter_name,
        parameter_description,
        parameter_active,
        parameter_document_parameter,
        parameter_simulation_parameter
    )
    RETURNING id AS parameter_id, name, description, active, document_parameter, simulation_parameter, created_at, updated_at;
$$;