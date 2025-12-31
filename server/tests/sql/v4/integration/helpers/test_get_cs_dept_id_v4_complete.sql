-- Get Computer Science department ID from seed data
-- Returns department_id for use in tests

BEGIN;

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
        id as department_id,
        title
    FROM departments
    WHERE title = 'Computer Science'
    LIMIT 1;
$$;

COMMIT;

