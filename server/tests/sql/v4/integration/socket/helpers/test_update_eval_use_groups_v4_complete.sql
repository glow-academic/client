-- Update eval use_groups flag
-- Returns eval_id
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
    WITH groups_flag AS (
        SELECT id FROM flags WHERE name = 'groups' LIMIT 1
    )
    UPDATE eval_flags ef
    SET value = test_update_eval_use_groups_v4.use_groups
    FROM groups_flag gf
    WHERE ef.eval_id = test_update_eval_use_groups_v4.eval_id
      AND ef.flag_id = gf.id
      AND ef.type = 'groups'::type_eval_flags
    RETURNING ef.eval_id as eval_id;
$$;