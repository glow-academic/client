-- Stop eval by marking all pending runs as completed
-- Parameters: $1=eval_id
-- Returns: stopped_count

WITH stopped_runs AS (
    UPDATE eval_model_runs 
    SET completed = true, updated_at = NOW()
    WHERE eval_id = $1::uuid AND completed = false
    RETURNING model_run_id
)
SELECT COUNT(*)::int as stopped_count
FROM stopped_runs

