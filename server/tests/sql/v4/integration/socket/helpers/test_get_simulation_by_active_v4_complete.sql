-- Get first active simulation for test setup
-- Returns simulation ID

BEGIN;

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
    SELECT id FROM simulations WHERE active = true LIMIT 1;
$$;

COMMIT;

