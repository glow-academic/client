-- Create a message
-- Parameters: $1=run_id (uuid), $2=role (message_role: 'user' or 'assistant'), $3=content (text), $4=completed (boolean)
-- Returns: id and created_at
INSERT INTO messages (run_id, role, content, completed, created_at)
VALUES ($1::uuid, $2::message_role, $3::text, $4::bool, NOW())
RETURNING id, created_at

