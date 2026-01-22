-- Create a test eval with runs_entry for testing
-- Parameters: $1 = agent_id (UUID, optional), $2 = eval_agent_id (UUID, optional), $3 = rubric_id (UUID, optional)
-- Returns: eval_id (UUID), run_id_1 (UUID), run_id_2 (UUID)
-- Creates eval, creates 2 runs_entry, and links them via eval_runs_junction
WITH new_eval AS (
    INSERT INTO evals(name, description, active, agent_id, eval_agent_id, rubric_id)
    VALUES (
        'Test Eval',
        'Test Description',
        true,
        $1::uuid,
        $2::uuid,
        $3::uuid
    )
    RETURNING id as eval_id
),
run1 AS (
    INSERT INTO runs_entry(input_tokens, output_tokens)
    VALUES (0, 0)
    RETURNING id as run_id
),
run2 AS (
    INSERT INTO runs_entry(input_tokens, output_tokens)
    VALUES (0, 0)
    RETURNING id as run_id
),
link1 AS (
    INSERT INTO eval_runs_junction(eval_id, run_id, completed)
    SELECT ne.eval_id, r1.run_id, false
    FROM new_eval ne, run1 r1
),
link2 AS (
    INSERT INTO eval_runs_junction(eval_id, run_id, completed)
    SELECT ne.eval_id, r2.run_id, false
    FROM new_eval ne, run2 r2
)
SELECT 
    ne.eval_id::text as eval_id,
    (SELECT run_id::text FROM run1) as run_id_1,
    (SELECT run_id::text FROM run2) as run_id_2
FROM new_eval ne;

