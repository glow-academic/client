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
    INSERT INTO eval_attempts_entry (created_at, infinite_mode)
    VALUES (NOW(), COALESCE(api_start_benchmark_attempt_v4.infinite_mode, false))
    RETURNING id as attempt_id, infinite_mode
),
new_attempt_junction AS (
    INSERT INTO eval_attempts_junction (eval_id, attempt_id)
    SELECT api_start_benchmark_attempt_v4.eval_id, na.attempt_id
    FROM new_attempt na
    RETURNING eval_id, attempt_id
),
eval_data AS (
    SELECT 
        e.id as eval_id,
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'dynamic' AND ef.value = TRUE) as dynamic,
        EXISTS (SELECT 1 FROM eval_flags_junction ef JOIN flags_resource f ON ef.flag_id = f.id WHERE ef.eval_id = e.id AND f.name = 'groups_entry' AND ef.value = TRUE) as use_groups
    FROM eval_artifact e
    WHERE e.id = api_start_benchmark_attempt_v4.eval_id
),
eval_agents_data AS (
    SELECT 
        ARRAY_AGG(ea.agent_id::text ORDER BY ea.created_at) as agent_ids
    FROM eval_agents_junction ea
    WHERE ea.eval_id = api_start_benchmark_attempt_v4.eval_id
),
pending_runs AS (
    SELECT ARRAY_AGG(er.run_id::uuid) FILTER (WHERE er.completed = false) as pending_run_ids
    FROM eval_runs_junction er
    WHERE er.eval_id = api_start_benchmark_attempt_v4.eval_id AND er.completed = false
),
pending_groups AS (
    SELECT ARRAY_AGG(eg.group_id::uuid) FILTER (WHERE NOT EXISTS (SELECT 1 FROM grades_entry gr JOIN runs_entry r ON r.id = gr.run_id WHERE r.group_id = eg.group_id)) as pending_group_ids
    FROM eval_groups_junction eg
    WHERE eg.eval_id = api_start_benchmark_attempt_v4.eval_id
      AND NOT EXISTS (SELECT 1 FROM grades_entry gr JOIN runs_entry r ON r.id = gr.run_id WHERE r.group_id = eg.group_id)
)
SELECT 
    na.attempt_id::text,
    ed.eval_id::text,
    COALESCE(NULL::uuid[], ARRAY[]::uuid[]) as agent_ids,
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