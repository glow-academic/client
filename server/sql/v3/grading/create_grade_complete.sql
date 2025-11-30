-- Create a grade record
-- Parameters: $1=run_id (uuid), $2=rubric_id (uuid), $3=description (text), $4=passed (boolean), $5=score (integer), $6=time_taken (integer)
-- Returns: grade_id (uuid as text)
INSERT INTO grades 
(passed, score, description, time_taken, rubric_id, run_id, eval, created_at)
VALUES ($4, $5, $3, $6, $2::uuid, $1::uuid, false, NOW())
RETURNING id::text

