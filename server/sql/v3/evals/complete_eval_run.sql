-- Mark eval_run as completed (stopped)
-- Parameters: $1=attempt_id (uuid), $2=run_id (uuid)
UPDATE eval_runs SET completed = true, updated_at = NOW()
WHERE eval_id = (
    SELECT eval_id FROM eval_attempts WHERE id = $1::uuid
) AND run_id = $2::uuid

