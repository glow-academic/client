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
    INSERT INTO departments(title, description)
    VALUES (
        COALESCE(test_create_test_department_v4.title, 'Test Department'),
        COALESCE(test_create_test_department_v4.description, 'Test Description')
    )
    RETURNING id, title, description, created_at;
$$;