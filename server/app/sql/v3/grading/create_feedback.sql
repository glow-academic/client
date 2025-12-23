-- Create a single feedback record
-- Parameters: $1=grade_id (uuid), $2=standard_id (uuid), $3=total (integer), $4=feedback (text)
-- Returns: feedback_id (uuid as text)
INSERT INTO feedbacks 
(grade_id, standard_id, total, feedback, created_at)
VALUES ($1::uuid, $2::uuid, $3::integer, $4::text, NOW())
RETURNING id::text

