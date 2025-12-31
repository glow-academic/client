-- Get rubric simulation count for test verification
-- Returns count of simulations linked to rubric

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_rubric_simulation_count_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_rubric_simulation_count_v4(
    input_rubric_id uuid
)
RETURNS TABLE (
    simulation_count bigint
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        COUNT(*)::bigint AS simulation_count
    FROM simulations
    WHERE rubric_id = input_rubric_id;
$$;

COMMIT;

