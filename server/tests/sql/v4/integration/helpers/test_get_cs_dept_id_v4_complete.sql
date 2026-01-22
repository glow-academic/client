-- Get Computer Science department ID from seed data
-- Returns department_id for use in tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_cs_dept_id_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_cs_dept_id_v4()
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
    WHERE (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) = 'Computer Science'
    LIMIT 1;
$$;