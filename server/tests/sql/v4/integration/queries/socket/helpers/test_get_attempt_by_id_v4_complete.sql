-- Get attempt by ID for test verification
-- Returns attempt details
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
    SELECT ae.id, saj.simulation_id
    FROM attempts_entry ae
    LEFT JOIN simulation_attempts_junction saj ON saj.attempt_id = ae.id
    WHERE ae.id = test_get_attempt_by_id_v4.attempt_id;
$$;