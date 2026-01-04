-- Create a test eval run and link it to an eval
-- Returns run_id and eval_id

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_eval_run_v4(uuid, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_eval_run_v4(
    eval_id uuid,
    completed boolean DEFAULT false
)
RETURNS TABLE (
    run_id uuid,
    eval_id uuid,
    completed boolean
)
LANGUAGE sql
VOLATILE
AS $$
    WITH new_run AS (
        INSERT INTO runs (input_tokens, output_tokens)
        VALUES (0, 0)
        RETURNING id as run_id
    ),
    link_run AS (
        INSERT INTO eval_runs (eval_id, run_id, completed)
        SELECT 
            test_create_test_eval_run_v4.eval_id,
            nr.run_id,
            test_create_test_eval_run_v4.completed
        FROM new_run nr
        RETURNING run_id, eval_id, completed
    )
    SELECT 
        lr.run_id,
        lr.eval_id,
        lr.completed
    FROM link_run lr;
$$;

COMMIT;

