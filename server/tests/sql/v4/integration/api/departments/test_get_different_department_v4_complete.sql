-- Get a different department (not the one provided) for test setup
-- Returns department_id for use in tests
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_different_department_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_different_department_v4(
    exclude_department_id uuid
)
RETURNS TABLE (
    department_id uuid,
    title text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id as department_id,
        title
    FROM departments
    WHERE id != test_get_different_department_v4.exclude_department_id
    LIMIT 1;
$$;