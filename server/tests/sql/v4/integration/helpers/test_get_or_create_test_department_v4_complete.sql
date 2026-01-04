-- Get existing department by title or create a new one
-- Returns department_id for use in tests
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
    WITH existing_dept AS (
        SELECT id, title
        FROM departments
        WHERE title = test_get_or_create_test_department_v4.title
        LIMIT 1
    ),
    new_dept AS (
        INSERT INTO departments(title, description, active)
        SELECT 
            test_get_or_create_test_department_v4.title,
            test_get_or_create_test_department_v4.description,
            true
        WHERE NOT EXISTS (SELECT 1 FROM existing_dept)
        RETURNING id, title
    )
    SELECT 
        COALESCE(ed.id, nd.id) as department_id,
        COALESCE(ed.title, nd.title) as title
    FROM existing_dept ed
    FULL OUTER JOIN new_dept nd ON true
    WHERE ed.id IS NOT NULL OR nd.id IS NOT NULL
    LIMIT 1;
$$;