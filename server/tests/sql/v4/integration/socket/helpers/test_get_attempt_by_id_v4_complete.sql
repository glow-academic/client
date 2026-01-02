-- Get attempt by ID for test verification
-- Returns attempt details

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_attempt_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_attempt_by_id_v4(
    attempt_id uuid
)
RETURNS TABLE (
    id uuid,
    simulation_id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, simulation_id 
    FROM simulation_attempts 
    WHERE id = test_get_attempt_by_id_v4.attempt_id;
$$;

COMMIT;

