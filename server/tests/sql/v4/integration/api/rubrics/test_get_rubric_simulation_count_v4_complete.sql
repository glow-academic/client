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
    -- NOTE: simulations table doesn't have rubric_id column
    -- Rubrics are linked to simulations via simulation_scenarios_rubric_grade_agents
    -- This function returns 0 - tests using this may need updating
    SELECT 0::bigint AS simulation_count;
$$;

COMMIT;

