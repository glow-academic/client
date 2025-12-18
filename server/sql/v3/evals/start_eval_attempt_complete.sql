-- Start eval attempt: create attempt and get eval data + pending runs
-- Parameters: $1=eval_id (uuid)
-- Returns: attempt_id, eval_id, agent_id, eval_agent_id, rubric_id, pending_run_ids (uuid[])
WITH new_attempt AS (
    INSERT INTO eval_attempts (eval_id, created_at)
    VALUES ($1::uuid, NOW())
    RETURNING id as attempt_id
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        e.agent_id::text as agent_id,
        e.eval_agent_id::text as eval_agent_id,
        e.rubric_id::text as rubric_id
    FROM evals e
    WHERE e.id = $1::uuid
),
pending_runs AS (
    SELECT ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false) as pending_run_ids
    FROM eval_runs er
    WHERE er.eval_id = $1::uuid AND er.completed = false
)
SELECT 
    na.attempt_id::text,
    ed.eval_id::text,
    ed.agent_id,
    ed.eval_agent_id,
    ed.rubric_id,
    COALESCE(pr.pending_run_ids, ARRAY[]::text[]) as pending_run_ids
FROM new_attempt na
CROSS JOIN eval_data ed
LEFT JOIN pending_runs pr ON true

