-- Create message feedback with replaces and highlights
-- Parameters: $1=grade_id (uuid), $2=message_id (uuid), $3=name (text), $4=description (text), $5=type (text: 'strength' or 'improvement')
-- Returns: message_feedback_id (uuid as text)
INSERT INTO message_feedbacks 
(grade_id, message_id, name, description, type, created_at)
VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::message_feedback_type, NOW())
RETURNING id::text

