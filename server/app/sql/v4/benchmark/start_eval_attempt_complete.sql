-- Start eval attempt: create attempt and get eval data + pending runs
-- Parameters: $1=eval_id (uuid), $2=infinite_mode (boolean)
-- Returns: attempt_id, eval_id, agent_ids (text[]), dynamic, infinite_mode, pending_run_ids (uuid[])
-- Note: eval_agent_id and rubric_id are now NULL at attempt level (they're per run/group)
WITH new_attempt AS (
    INSERT INTO eval_attempts (eval_id, created_at, infinite_mode)
    VALUES ($1::uuid, NOW(), COALESCE($2::bool, false))
    RETURNING id as attempt_id, infinite_mode
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        e.dynamic
    FROM evals e
    WHERE e.id = $1::uuid
),
eval_agents_data AS (
    SELECT 
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents ea
    WHERE ea.eval_id = $1::uuid
),
pending_runs AS (
    SELECT ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false) as pending_run_ids
    FROM eval_runs er
    WHERE er.eval_id = $1::uuid AND er.completed = false
)
SELECT 
    na.attempt_id::text,
    ed.eval_id::text,
    COALESCE(ead.agent_ids, ARRAY[]::text[]) as agent_ids,
    ed.dynamic,
    na.infinite_mode,
    COALESCE(pr.pending_run_ids, ARRAY[]::text[]) as pending_run_ids
FROM new_attempt na
CROSS JOIN eval_data ed
LEFT JOIN eval_agents_data ead ON true
LEFT JOIN pending_runs pr ON true

