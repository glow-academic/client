-- Update token counts for a completed model run
-- Parameters: $1=run_id (uuid), $2=input_tokens (integer), $3=output_tokens (integer)
UPDATE runs 
SET input_tokens = $2, output_tokens = $3
WHERE id = $1::uuid

