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
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title
    FROM departments_resource d
    WHERE d.id != test_get_different_department_v4.exclude_department_id
    LIMIT 1;
$$;