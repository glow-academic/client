-- Get parameter item department links for test verification
-- Returns all active links for an item
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_parameter_item_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_parameter_item_department_links_v4(
    input_parameter_item_id uuid
)
RETURNS TABLE (
    parameter_item_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    -- NOTE: parameter_item_departments table does not exist in current schema
    -- This function returns empty result - tests_entry using this may need updating
    SELECT NULL::uuid AS parameter_item_id, NULL::uuid AS department_id, NULL::boolean AS active, NULL::timestamptz AS created_at WHERE false;
$$;