-- Get attempt by ID for test verification
-- Returns attempt details
-- Updated for migration 331: Queries both general_attempts_entry and practice_attempts_entry
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
    WITH all_attempts AS (
        SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active, false as is_practice
        FROM general_attempts_entry
        UNION ALL
        SELECT id, created_at, updated_at, infinite_mode, archived, generated, mcp, active, true as is_practice
        FROM practice_attempts_entry
    ),
    all_attempt_simulations AS (
        SELECT attempt_id, simulations_id
        FROM general_attempts_simulations_connection
        UNION ALL
        SELECT attempt_id, simulations_id
        FROM practice_attempts_simulations_connection
    )
    SELECT ae.id, sim_ssj.simulation_id
    FROM all_attempts ae
    LEFT JOIN all_attempt_simulations aas ON aas.attempt_id = ae.id
    LEFT JOIN simulation_simulations_junction sim_ssj ON sim_ssj.simulations_id = aas.simulations_id
    WHERE ae.id = test_get_attempt_by_id_v4.attempt_id;
$$;
