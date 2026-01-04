-- Get first active eval for test setup
-- Returns eval ID
-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_eval_by_active_v4();

-- Create function
CREATE OR REPLACE FUNCTION test_get_eval_by_active_v4()
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
    SELECT id FROM evals WHERE active = true LIMIT 1;
$$;