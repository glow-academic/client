-- Create a test eval attempt with pending runs_entry
-- Parameters: $1 = eval_id (UUID), $2 = run_id_1 (UUID), $3 = run_id_2 (UUID, optional), $4 = conversation_mode (bool, optional)
-- Returns: attempt_id (UUID)
-- Note: eval_runs_junction must already exist for the eval_id
WITH new_attempt AS (
    INSERT INTO eval_attempts (eval_id, conversation_mode)
    VALUES ($1::uuid, COALESCE($4::bool, false))
    RETURNING id as attempt_id
)
SELECT attempt_id::text FROM new_attempt;

