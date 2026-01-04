-- Create a test rubric for test setup
-- Returns rubric data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_rubric_v4(text, text, integer, integer, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_rubric_v4(
    rubric_name text,
    rubric_description text,
    rubric_points integer,
    rubric_pass_points integer,
    rubric_active boolean
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
VOLATILE
AS $$
    INSERT INTO rubrics(name, description, points, pass_points, active)
    VALUES (
        rubric_name,
        rubric_description,
        rubric_points,
        rubric_pass_points,
        rubric_active
    )
    RETURNING id AS rubric_id, name, description, points, pass_points, active, created_at, updated_at;
$$;