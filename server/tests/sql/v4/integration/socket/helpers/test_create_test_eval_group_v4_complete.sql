-- Create a test eval group and link it to an eval
-- Returns group_id and eval_id
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_eval_group_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_eval_group_v4(
    eval_id uuid
)
RETURNS TABLE (
    group_id uuid,
    eval_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_group AS (
        INSERT INTO groups (trace_id)
        VALUES (gen_trace_id())
        RETURNING id as group_id
    ),
    link_group AS (
        INSERT INTO eval_groups (eval_id, group_id)
        SELECT 
            test_create_test_eval_group_v4.eval_id,
            ng.group_id
        FROM new_group ng
        RETURNING group_id, eval_id
    )
    SELECT 
        lg.group_id,
        lg.eval_id
    FROM link_group lg;
$$;