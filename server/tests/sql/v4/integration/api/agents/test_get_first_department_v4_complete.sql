-- Get first department ID for test setup
-- Returns department_id for use in tests

BEGIN;

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
        id as department_id,
        title
    FROM departments
    LIMIT 1;
$$;

COMMIT;

