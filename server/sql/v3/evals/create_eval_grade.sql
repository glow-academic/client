-- Create eval grade record
-- Parameters: $1=model_run_id, $2=eval_id, $3=description, $4=passed, $5=score, $6=time_taken
-- Returns: grade_id

INSERT INTO eval_grades 
(model_run_id, eval_id, description, passed, score, time_taken, created_at)
VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, NOW())
RETURNING id::text as grade_id

