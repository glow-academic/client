-- Create a test attempt for socket view_tests_entry
-- Returns attempt_id
-- Unified view_simulation_attempts_entry (practice flag determines type)
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_attempt_v4(uuid);
DROP FUNCTION IF EXISTS test_create_test_attempt_v4(uuid, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_attempt_v4(
    simulation_id uuid,
    is_practice boolean DEFAULT false
)
RETURNS TABLE (
    attempt_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH simulation_resource AS (
        -- Get simulations_resource.id for the connection table
        SELECT ssj.simulations_id
        FROM simulation_simulations_junction ssj
        WHERE ssj.simulation_id = test_create_test_attempt_v4.simulation_id
        LIMIT 1
    ),
    new_attempt AS (
        -- Create simulation attempt (practice flag determines type)
        INSERT INTO simulation_attempts_entry (archived, practice)
        SELECT false, test_create_test_attempt_v4.is_practice
        RETURNING id
    ),
    simulation_connection AS (
        INSERT INTO simulation_attempts_simulations_connection(attempt_id, simulations_id)
        SELECT na.id, sr.simulations_id
        FROM new_attempt na
        CROSS JOIN simulation_resource sr
        WHERE sr.simulations_id IS NOT NULL
    )
    SELECT id AS attempt_id FROM new_attempt;
$$;
