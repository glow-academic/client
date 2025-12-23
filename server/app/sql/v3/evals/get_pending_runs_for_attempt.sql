-- Get pending runs for eval attempt
-- Parameters: $1 = attempt_id (uuid)
-- Returns: run_id[] (text[]) of pending runs (where completed = false)

SELECT ARRAY_AGG(er.run_id::text) FILTER (WHERE er.completed = false) as pending_run_ids
FROM eval_attempts ea
JOIN eval_runs er ON er.eval_id = ea.eval_id
WHERE ea.id = $1::uuid
  AND er.completed = false

