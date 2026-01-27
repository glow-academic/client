-- Get first department ID for test setup
-- Returns department_id for use in view_tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_first_department_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_first_department_v4()
RETURNS TABLE (
    department_id uuid,
    title text
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title
    FROM departments_resource d
    LIMIT 1;
$$;