-- Get or create a test rubric for test setup
-- Returns rubric_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_or_create_rubric_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_or_create_rubric_v4()
RETURNS TABLE (
    rubric_id uuid,
    name text,
    description text,
    points integer,
    pass_points integer,
    active boolean
)
LANGUAGE sql
VOLATILE
AS $$
    WITH existing_rubric AS (
        SELECT id, name, description, points, pass_points, active
        FROM rubrics
        LIMIT 1
    ),
    new_rubric AS (
        INSERT INTO rubrics(name, description, points, pass_points, active)
        SELECT 'Test Rubric', 'Test', 100, 70, true
        WHERE NOT EXISTS (SELECT 1 FROM existing_rubric)
        RETURNING id, name, description, points, pass_points, active
    )
    SELECT id as rubric_id, name, description, points, pass_points, active
    FROM existing_rubric
    UNION ALL
    SELECT id as rubric_id, name, description, points, pass_points, active
    FROM new_rubric
    LIMIT 1;
$$;

COMMIT;

