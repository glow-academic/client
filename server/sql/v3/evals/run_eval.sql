-- Mark eval as running and get model_runs to evaluate
-- Parameters: $1=eval_id
-- Returns: eval_id, rubric_id, model_run_ids

SELECT 
    e.id::text as eval_id,
    e.rubric_id::text as rubric_id,
    ARRAY_AGG(emr.model_run_id::text) FILTER (WHERE emr.completed = false) as pending_model_run_ids
FROM evals e
LEFT JOIN eval_model_runs emr ON emr.eval_id = e.id AND emr.completed = false
WHERE e.id = $1::uuid
GROUP BY e.id, e.rubric_id

