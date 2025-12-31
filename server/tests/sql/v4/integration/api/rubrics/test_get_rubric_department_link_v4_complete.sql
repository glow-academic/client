-- Get rubric department link for test verification
-- Returns link data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_department_link_v4(uuid, uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_department_link_v4(
    input_rubric_id uuid,
    input_department_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    department_id uuid,
    active boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        rubric_id,
        department_id,
        active,
        created_at
    FROM rubric_departments
    WHERE rubric_id = input_rubric_id
      AND department_id = input_department_id;
$$;

COMMIT;

