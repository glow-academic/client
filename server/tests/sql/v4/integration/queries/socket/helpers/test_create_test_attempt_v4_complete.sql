-- Create a test attempt for socket tests_entry
-- Returns attempt_id
-- Updated for migration 331: Creates general_attempts_entry (non-practice)
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
    new_general_attempt AS (
        -- Create general attempt (non-practice)
        INSERT INTO general_attempts_entry(archived)
        SELECT false
        WHERE NOT test_create_test_attempt_v4.is_practice
        RETURNING id
    ),
    new_practice_attempt AS (
        -- Create practice attempt
        INSERT INTO practice_attempts_entry(archived)
        SELECT false
        WHERE test_create_test_attempt_v4.is_practice
        RETURNING id
    ),
    general_connection AS (
        INSERT INTO general_attempts_simulations_connection(attempt_id, simulations_id)
        SELECT nga.id, sr.simulations_id
        FROM new_general_attempt nga
        CROSS JOIN simulation_resource sr
        WHERE sr.simulations_id IS NOT NULL
    ),
    practice_connection AS (
        INSERT INTO practice_attempts_simulations_connection(attempt_id, simulations_id)
        SELECT npa.id, sr.simulations_id
        FROM new_practice_attempt npa
        CROSS JOIN simulation_resource sr
        WHERE sr.simulations_id IS NOT NULL
    )
    SELECT id AS attempt_id FROM new_general_attempt
    UNION ALL
    SELECT id AS attempt_id FROM new_practice_attempt;
$$;
