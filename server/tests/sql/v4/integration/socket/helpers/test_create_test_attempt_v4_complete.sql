-- Create a test attempt for socket tests
-- Returns attempt_id

BEGIN;

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
    INSERT INTO attempts(simulation_id, active) 
    VALUES (test_create_test_attempt_v4.simulation_id, true) 
    RETURNING id as attempt_id;
$$;

COMMIT;

