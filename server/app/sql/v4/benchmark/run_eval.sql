-- Mark eval as running and get runs/groups to evaluate
-- Parameters: $1=eval_id, $2=profile_id (uuid)
-- Returns: eval_id, rubric_grade_agent_ids, run_ids, group_ids, eval_name, actor_name

WITH actor_profile AS (
    SELECT
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
eval_data AS (
    SELECT 
        e.id::text as eval_id,
        e.name as eval_name,
        ARRAY_AGG(DISTINCT erga.rubric_grade_agent_id::text) as rubric_grade_agent_ids,
        ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false) as pending_run_ids,
        ARRAY_AGG(eg.group_id::text) FILTER (WHERE eg.group_id IS NOT NULL) as group_ids
    FROM evals e
    LEFT JOIN eval_rubric_grade_agents erga ON erga.eval_id = e.id
    LEFT JOIN eval_runs er ON er.eval_id = e.id AND er.completed = false
    LEFT JOIN eval_groups eg ON eg.eval_id = e.id
    WHERE e.id = $1::uuid
    GROUP BY e.id
)
SELECT 
    ed.eval_id,
    ed.rubric_grade_agent_ids,
    ed.pending_run_ids,
    ed.group_ids,
    ed.eval_name,
    ap.actor_name
FROM eval_data ed
CROSS JOIN actor_profile ap

