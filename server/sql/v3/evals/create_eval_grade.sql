-- Create eval grade record
-- Parameters: $1=run_id, $2=eval_id, $3=description, $4=passed, $5=score, $6=time_taken, $7=rubric_id
-- Returns: grade_id

INSERT INTO grades 
(run_id, eval_id, rubric_id, description, passed, score, time_taken, eval, created_at)
VALUES ($1::uuid, $2::uuid, $7::uuid, $3, $4, $5, $6, true, NOW())
RETURNING id::text as grade_id

