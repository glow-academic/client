-- Start benchmark attempt: create attempt and get eval data + pending runs/groups
-- Parameters: $1=eval_id (uuid), $2=infinite_mode (boolean)
-- Returns: attempt_id, eval_id, agent_ids (text[]), dynamic, infinite_mode, use_groups, pending_run_ids (uuid[]), pending_group_ids (uuid[])
-- Note: rubric_grade_agent_ids are per run/group (via junction tables)
WITH new_attempt AS (
    INSERT INTO eval_attempts (eval_id, created_at, infinite_mode)
    VALUES ($1::uuid, NOW(), COALESCE($2::bool, false))
    RETURNING id as attempt_id, infinite_mode
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        e.dynamic,
        e.use_groups
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
    SELECT ARRAY_AGG(er.run_id::uuid) FILTER (WHERE er.completed = false) as pending_run_ids
    FROM eval_runs er
    WHERE er.eval_id = $1::uuid AND er.completed = false
),
pending_groups AS (
    SELECT ARRAY_AGG(eg.group_id::uuid) FILTER (WHERE eg.completed = false) as pending_group_ids
    FROM eval_groups eg
    WHERE eg.eval_id = $1::uuid AND eg.completed = false
)
SELECT 
    na.attempt_id::text,
    ed.eval_id::text,
    COALESCE(ead.agent_ids, ARRAY[]::text[]) as agent_ids,
    ed.dynamic,
    na.infinite_mode,
    ed.use_groups,
    COALESCE(pr.pending_run_ids, ARRAY[]::uuid[]) as pending_run_ids,
    COALESCE(pg.pending_group_ids, ARRAY[]::uuid[]) as pending_group_ids
FROM new_attempt na
CROSS JOIN eval_data ed
LEFT JOIN eval_agents_data ead ON true
LEFT JOIN pending_runs pr ON true
LEFT JOIN pending_groups pg ON true

