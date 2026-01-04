-- Create a test standard for test setup
-- Returns standard data for assertions
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_standard_v4(uuid, text, text, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_standard_v4(
    input_standard_group_id uuid,
    standard_name text,
    standard_description text,
    standard_points integer
)
RETURNS TABLE (
    standard_id uuid,
    standard_group_id uuid,
    name text,
    description text,
    points integer,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO standards(standard_group_id, name, description, points)
    VALUES (
        input_standard_group_id,
        standard_name,
        standard_description,
        standard_points
    )
    RETURNING id AS standard_id, standard_group_id, name, description, points, created_at, created_at AS updated_at;
$$;