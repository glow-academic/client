-- Create a key department link for test setup
-- Returns link data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_key_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_key_department_link_v4(
    key_id uuid,
    department_id uuid
)
RETURNS TABLE (
    key_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: key_departments table does not exist in current schema
    -- This function returns empty result - view_tests_entry using this may need updating
    SELECT NULL::uuid AS key_id, NULL::uuid AS department_id, NULL::boolean AS active, NULL::timestamptz AS created_at WHERE false;
$$;