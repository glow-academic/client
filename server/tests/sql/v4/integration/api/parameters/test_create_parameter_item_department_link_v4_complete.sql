-- Create a parameter item department link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_parameter_item_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_parameter_item_department_link_v4(
    parameter_item_id uuid,
    department_id uuid
)
RETURNS TABLE (
    parameter_item_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: parameter_item_departments table does not exist in current schema
    -- This function returns empty result - tests using this may need updating
    SELECT NULL::uuid AS parameter_item_id, NULL::uuid AS department_id, NULL::boolean AS active, NULL::timestamptz AS created_at WHERE false;
$$;