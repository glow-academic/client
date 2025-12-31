-- Get department by ID for test verification
-- Returns department data for assertions

BEGIN;

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
        id as department_id,
        title,
        description,
        created_at,
        updated_at
    FROM departments
    WHERE id = test_get_department_by_id_v4.input_department_id;
$$;

COMMIT;

