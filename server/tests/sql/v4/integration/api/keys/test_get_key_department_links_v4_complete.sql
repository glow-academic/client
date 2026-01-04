-- Get key department links for test verification
-- Returns all active links for a key
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_key_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_key_department_links_v4(
    input_key_id uuid
)
RETURNS TABLE (
    key_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    -- NOTE: key_departments table does not exist in current schema
    -- This function returns empty result - tests using this may need updating
    SELECT NULL::uuid AS key_id, NULL::uuid AS department_id, NULL::boolean AS active, NULL::timestamptz AS created_at WHERE false;
$$;