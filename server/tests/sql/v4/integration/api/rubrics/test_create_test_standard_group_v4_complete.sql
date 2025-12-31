-- Create a test standard group for test setup
-- Returns standard group data for assertions

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_standard_group_v4(uuid, text, text, text, integer, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_standard_group_v4(
    input_rubric_id uuid,
    group_name text,
    group_short_name text,
    group_description text,
    group_points integer,
    group_pass_points integer
)
RETURNS TABLE (
    standard_group_id uuid,
    rubric_id uuid,
    name text,
    short_name text,
    description text,
    points integer,
    pass_points integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO standard_groups(rubric_id, name, short_name, description, points, pass_points)
    VALUES (
        input_rubric_id,
        group_name,
        group_short_name,
        group_description,
        group_points,
        group_pass_points
    )
    RETURNING id AS standard_group_id, rubric_id, name, short_name, description, points, pass_points, created_at, updated_at;
$$;

COMMIT;

