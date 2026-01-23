-- Get all rubric department links for test verification
-- Returns all links for a rubric
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_department_links_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_department_links_v4(
    input_rubric_id uuid
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
    FROM rubric_departments_junction
    WHERE rubric_id = input_rubric_id;
$$;