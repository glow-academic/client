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
    SELECT e.id 
    FROM evals_resource e
    WHERE EXISTS (SELECT 1 FROM eval_flags ef JOIN flags_resource fl ON ef.flag_id = fl.id WHERE ef.eval_id = e.id AND fl.name = 'active'  AND ef.value = TRUE)
    LIMIT 1;
$$;