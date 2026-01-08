DROP FUNCTION IF EXISTS api_start_benchmark_attempt_v4(uuid, boolean);
CREATE OR REPLACE FUNCTION api_start_benchmark_attempt_v4(
    eval_id uuid,
    infinite_mode boolean
)
RETURNS TABLE (
    attempt_id text,
    eval_id text,
    agent_ids text[],
    dynamic boolean,
    infinite_mode boolean,
    use_groups boolean,
    pending_run_ids uuid[],
    pending_group_ids uuid[]
)
LANGUAGE sql
AS $$
WITH new_attempt AS (
    INSERT INTO eval_attempts (eval_id, created_at, infinite_mode)
    VALUES (api_start_benchmark_attempt_v4.eval_id, NOW(), COALESCE(api_start_benchmark_attempt_v4.infinite_mode, false))
    RETURNING id as attempt_id, infinite_mode
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        EXISTS (SELECT 1 FROM eval_flags ef JOIN flags fl ON ef.flag_id = fl.id WHERE ef.eval_id = e.id AND fl.name = 'dynamic' AND ef.type = 'dynamic'::type_eval_flags AND ef.value = TRUE) as dynamic,
        EXISTS (SELECT 1 FROM eval_flags ef JOIN flags fl ON ef.flag_id = fl.id WHERE ef.eval_id = e.id AND fl.name = 'groups' AND ef.type = 'groups'::type_eval_flags AND ef.value = TRUE) as use_groups
    FROM evals e
    WHERE e.id = api_start_benchmark_attempt_v4.eval_id
),
eval_agents_data AS (
    SELECT 
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents ea
    WHERE ea.eval_id = api_start_benchmark_attempt_v4.eval_id
),
pending_runs AS (
    SELECT ARRAY_AGG(er.run_id::uuid) FILTER (WHERE er.completed = false) as pending_run_ids
    FROM eval_runs er
    WHERE er.eval_id = api_start_benchmark_attempt_v4.eval_id AND er.completed = false
),
pending_groups AS (
    SELECT ARRAY_AGG(eg.group_id::uuid) FILTER (WHERE NOT EXISTS (SELECT 1 FROM grade_groups gg WHERE gg.group_id = eg.group_id)) as pending_group_ids
    FROM eval_groups eg
    WHERE eg.eval_id = api_start_benchmark_attempt_v4.eval_id
      AND NOT EXISTS (SELECT 1 FROM grade_groups gg WHERE gg.group_id = eg.group_id)
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
$$;