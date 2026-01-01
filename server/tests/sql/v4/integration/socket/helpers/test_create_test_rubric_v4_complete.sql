-- Create a test rubric for socket tests
-- Returns rubric_id

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_rubric_v4(text, text, integer, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_rubric_v4(
    name text DEFAULT 'Test Rubric',
    description text DEFAULT 'Test Description',
    points integer DEFAULT 100,
    pass_points integer DEFAULT 70
)
RETURNS TABLE (
    rubric_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO rubrics(name, description, points, pass_points, active) 
    VALUES (
        test_create_test_rubric_v4.name, 
        test_create_test_rubric_v4.description, 
        test_create_test_rubric_v4.points, 
        test_create_test_rubric_v4.pass_points, 
        true
    ) 
    RETURNING id as rubric_id;
$$;

COMMIT;

