-- Create a test department for test setup
-- Returns department_id for use in tests
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
        INSERT INTO departments DEFAULT VALUES
        RETURNING id, created_at
    ),
    name_resource AS (
        INSERT INTO names(name)
        VALUES (COALESCE(test_create_test_department_v4.title, 'Test Department'))
        RETURNING id
    ),
    description_resource AS (
        INSERT INTO descriptions(description)
        VALUES (COALESCE(test_create_test_department_v4.description, 'Test Description'))
        RETURNING id
    ),
    department_name_link AS (
        INSERT INTO department_names(department_id, name_id)
        SELECT nd.id, nr.id
        FROM new_department nd, name_resource nr
        RETURNING department_id
    ),
    department_description_link AS (
        INSERT INTO department_descriptions(department_id, description_id)
        SELECT nd.id, dr.id
        FROM new_department nd, description_resource dr
        RETURNING department_id
    )
    SELECT 
        nd.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = nd.id LIMIT 1) as title,
        (SELECT d.description FROM department_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.department_id = nd.id LIMIT 1) as description,
        nd.created_at
    FROM new_department nd;
$$;