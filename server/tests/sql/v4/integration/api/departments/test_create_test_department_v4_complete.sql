-- Create a test department for test setup
-- Returns department_id for use in tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_department_v4(text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_department_v4(
    title text DEFAULT 'Test Department',
    description text DEFAULT 'Test Description'
)
RETURNS TABLE (
    department_id uuid,
    title text,
    description text,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_department AS (
        INSERT INTO departments_resource DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (COALESCE(test_create_test_department_v4.title, 'Test Department'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (COALESCE(test_create_test_department_v4.description, 'Test Description'))
        RETURNING id
    ),
    department_name_link AS (
        INSERT INTO department_names_junction(department_id, name_id)
        SELECT nd.id, nr.id
        FROM new_department nd, name_resource nr
        RETURNING department_id
    ),
    department_description_link AS (
        INSERT INTO department_descriptions_junction(department_id, description_id)
        SELECT nd.id, dr.id
        FROM new_department nd, description_resource dr
        RETURNING department_id
    )
    SELECT 
        nd.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = nd.id LIMIT 1) as title,
        (SELECT d.description FROM department_descriptions_junction dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.department_id = nd.id LIMIT 1) as description,
        nd.created_at
    FROM new_department nd;
$$;