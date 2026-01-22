-- UPDATE eval_artifact use_groups flag
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
        SELECT id FROM flags_resource WHERE name = 'groups_entry' LIMIT 1
    )
    UPDATE eval_flags ef
    SET value = test_update_eval_use_groups_v4.use_groups
    FROM groups_flag gf
    WHERE ef.eval_id = test_update_eval_use_groups_v4.eval_id
      AND ef.flag_id = gf.id
      
    RETURNING ef.eval_id as eval_id;
$$;