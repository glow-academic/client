-- Create a test simulation for test setup
-- Returns simulation_id for use in tests

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_simulation_v4(text, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_simulation_v4(
    title text DEFAULT 'Test Simulation',
    description text DEFAULT 'Test Description',
    practice_simulation boolean DEFAULT false
)
RETURNS TABLE (
    simulation_id uuid,
    title text,
    description text,
    active boolean,
    practice_simulation boolean,
    created_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO simulations(
        title,
        description,
        active,
        practice_simulation
    )
    VALUES (
        COALESCE(test_create_test_simulation_v4.title, 'Test Simulation'),
        COALESCE(test_create_test_simulation_v4.description, 'Test Description'),
        true,
        COALESCE(test_create_test_simulation_v4.practice_simulation, false)
    )
    RETURNING id, title, description, active, practice_simulation, created_at;
$$;

COMMIT;

