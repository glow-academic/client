-- Create a rubric department link for test setup
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_rubric_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_rubric_department_link_v4(
    rubric_id uuid,
    department_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO rubric_departments(rubric_id, department_id, active)
    VALUES (
        test_create_rubric_department_link_v4.rubric_id,
        test_create_rubric_department_link_v4.department_id,
        true
    )
    RETURNING rubric_id, department_id, active, created_at;
$$;

COMMIT;

