-- Mark eval as running and get runs to evaluate
-- Parameters: $1=eval_id
-- Returns: eval_id, rubric_id, run_ids

SELECT 
    e.id::text as eval_id,
    e.rubric_id::text as rubric_id,
    ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false) as pending_run_ids
FROM evals e
LEFT JOIN eval_runs er ON er.eval_id = e.id AND er.completed = false
WHERE e.id = $1::uuid
GROUP BY e.id, e.rubric_id

