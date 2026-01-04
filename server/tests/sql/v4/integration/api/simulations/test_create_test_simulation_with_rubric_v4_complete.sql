-- Create a test simulation with rubric for test setup
-- Returns simulation_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_simulation_with_rubric_v4(uuid, text, text, boolean, boolean, integer);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_simulation_with_rubric_v4(
    rubric_id uuid,
    title text DEFAULT 'Test Simulation',
    description text DEFAULT 'Test Description',
    active boolean DEFAULT true,
    practice_simulation boolean DEFAULT false,
    time_limit integer DEFAULT NULL
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    time_limit integer,
    rubric_id uuid,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO simulations(
        title,
        description,
        active,
        practice_simulation,
        rubric_id,
        time_limit
    )
    VALUES (
        COALESCE(test_create_test_simulation_with_rubric_v4.title, 'Test Simulation'),
        COALESCE(test_create_test_simulation_with_rubric_v4.description, 'Test Description'),
        COALESCE(test_create_test_simulation_with_rubric_v4.active, true),
        COALESCE(test_create_test_simulation_with_rubric_v4.practice_simulation, false),
        test_create_test_simulation_with_rubric_v4.rubric_id,
        test_create_test_simulation_with_rubric_v4.time_limit
    )
    RETURNING id, title, description, active, practice_simulation, time_limit, rubric_id, created_at;
$$;

COMMIT;

