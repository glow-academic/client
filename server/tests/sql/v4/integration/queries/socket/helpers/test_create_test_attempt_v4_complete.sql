-- Create a test attempt for socket tests_entry
-- Returns attempt_id
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_attempt_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_attempt_v4(
    simulation_id uuid
)
RETURNS TABLE (
    attempt_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_attempt AS (
        INSERT INTO attempts_entry(archived)
        VALUES (false)
        RETURNING id
    ),
    junction_insert AS (
        INSERT INTO simulation_attempts_junction(simulation_id, attempt_id)
        SELECT test_create_test_attempt_v4.simulation_id, new_attempt.id
        FROM new_attempt
    )
    SELECT id AS attempt_id FROM new_attempt;
$$;