-- Update token counts for a completed model run
-- Parameters: $1=model_run_id (uuid), $2=input_tokens (integer), $3=output_tokens (integer)
UPDATE model_runs 
SET input_tokens = $2, output_tokens = $3
WHERE id = $1::uuid

