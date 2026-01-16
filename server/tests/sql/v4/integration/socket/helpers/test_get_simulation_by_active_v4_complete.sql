-- Get first active simulation for test setup
-- Returns simulation ID
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_simulation_by_active_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_simulation_by_active_v4()
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT s.id 
    FROM simulations_resource s
    WHERE EXISTS (SELECT 1 FROM simulation_flags sf JOIN flags_resource fl ON sf.flag_id = fl.id WHERE sf.simulation_id = s.id AND fl.name = 'active'  AND sf.value = TRUE)
    LIMIT 1;
$$;