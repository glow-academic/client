-- Create a simulation chat grade record
-- Parameters: $1=simulation_chat_id (uuid), $2=rubric_id (uuid), $3=description (text), $4=passed (boolean), $5=score (integer), $6=time_taken (integer)
-- Returns: grade_id (uuid as text)
INSERT INTO simulation_chat_grades 
(passed, score, description, time_taken, rubric_id, simulation_chat_id, created_at)
VALUES ($4, $5, $3, $6, $2::uuid, $1::uuid, NOW())
RETURNING id::text

