-- Get rubric by ID for test verification
-- Returns rubric details for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_by_id_v4(
    input_rubric_id uuid
)
RETURNS TABLE (
    rubric_id uuid,
    name text,
    description text,
    points integer,
    pass_points integer,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS rubric_id,
        name,
        description,
        points,
        pass_points,
        active,
        created_at,
        updated_at
    FROM rubrics
    WHERE id = input_rubric_id;
$$;

COMMIT;

