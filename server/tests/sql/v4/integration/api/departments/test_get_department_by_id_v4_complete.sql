-- Get department by ID for test verification
-- Returns department data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_department_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_department_by_id_v4(
    input_department_id uuid
)
RETURNS TABLE (
    department_id uuid,
    title text,
    description text,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title,
        (SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1) as description,
        d.created_at,
        d.updated_at
    FROM departments_resource d
    WHERE d.id = test_get_department_by_id_v4.input_department_id;
$$;