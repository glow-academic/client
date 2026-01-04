-- Update eval use_groups flag
-- Returns eval_id

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_update_eval_use_groups_v4(uuid, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_update_eval_use_groups_v4(
    eval_id uuid,
    use_groups boolean
)
RETURNS TABLE (
    eval_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    UPDATE evals
    SET use_groups = test_update_eval_use_groups_v4.use_groups
    WHERE id = test_update_eval_use_groups_v4.eval_id
    RETURNING id as eval_id;
$$;

COMMIT;

