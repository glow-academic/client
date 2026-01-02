-- Get parameter by ID for test verification
-- Returns parameter details for assertions

BEGIN;

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
        id AS parameter_id,
        name,
        description,
        active,
        document_parameter,
        simulation_parameter,
        created_at,
        updated_at
    FROM parameters
    WHERE id = input_parameter_id;
$$;

COMMIT;

