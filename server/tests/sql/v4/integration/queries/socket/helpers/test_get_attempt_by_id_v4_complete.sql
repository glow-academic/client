-- Get attempt by ID for test verification
-- Returns attempt details
-- Unified simulation_attempts_entry (practice flag determines type)
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
    SELECT ae.id, sim_ssj.simulation_id
    FROM simulation_attempts_entry ae
    LEFT JOIN simulation_attempts_simulations_connection aas ON aas.attempt_id = ae.id
    LEFT JOIN simulation_simulations_junction sim_ssj ON sim_ssj.simulations_id = aas.simulations_id
    WHERE ae.id = test_get_attempt_by_id_v4.attempt_id;
$$;
