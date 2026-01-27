-- Get existing department by title or create a new one
-- Returns department_id for use in view_tests_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_test_department_v4(text, text);

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_test_department_v4(
    title text DEFAULT 'Computer Science',
    description text DEFAULT 'Test Department Description'
)
RETURNS TABLE (
    department_id uuid,
    title text
)
LANGUAGE sql
VOLATILE
AS $$
    WITH name_resource AS (
        INSERT INTO names_resource(name)
        VALUES (test_get_or_create_test_department_v4.title)
        ON CONFLICT (name) DO NOTHING
        RETURNING id
    ),
    name_lookup AS (
        SELECT id FROM names_resource WHERE name = test_get_or_create_test_department_v4.title LIMIT 1
    ),
    description_resource AS (
        INSERT INTO descriptions_resource(description)
        VALUES (test_get_or_create_test_department_v4.description)
        ON CONFLICT (description) DO NOTHING
        RETURNING id
    ),
    description_lookup AS (
        SELECT id FROM descriptions_resource WHERE description = test_get_or_create_test_department_v4.description LIMIT 1
    ),
    active_flag AS (
        SELECT id FROM flags_resource WHERE name = 'active' LIMIT 1
    ),
    existing_dept AS (
        SELECT d.id, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title
        FROM departments_resource d
        WHERE (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) = test_get_or_create_test_department_v4.title
        LIMIT 1
    ),
    new_dept AS (
        INSERT INTO departments_resource DEFAULT VALUES
        RETURNING id
    ),
    new_dept_filtered AS (
        SELECT nd.id FROM new_dept nd
        WHERE NOT EXISTS (SELECT 1 FROM existing_dept)
    ),
    new_dept_name_link AS (
        INSERT INTO department_names_junction(department_id, name_id)
        SELECT ndf.id, COALESCE(nr.id, nl.id)
        FROM new_dept_filtered ndf, name_resource nr FULL OUTER JOIN name_lookup nl ON true
        RETURNING department_id
    ),
    new_dept_description_link AS (
        INSERT INTO department_descriptions_junction(department_id, description_id)
        SELECT ndf.id, COALESCE(dr.id, dl.id)
        FROM new_dept_filtered ndf, description_resource dr FULL OUTER JOIN description_lookup dl ON true
        RETURNING department_id
    ),
    new_dept_flag_link AS (
        INSERT INTO department_flags_junction (department_id, flag_id, value)
        SELECT ndf.id, af.id, true
        FROM new_dept_filtered ndf, active_flag af
        RETURNING department_id
    )
    SELECT 
        COALESCE(ed.id, ndf.id) as department_id,
        COALESCE(ed.title, (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ndf.id LIMIT 1)) as title
    FROM existing_dept ed
    FULL OUTER JOIN new_dept_filtered ndf ON true
    WHERE ed.id IS NOT NULL OR ndf.id IS NOT NULL
    LIMIT 1;
$$;