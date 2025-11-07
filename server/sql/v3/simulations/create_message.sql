-- Create a simulation message
-- Parameters: $1=chat_id (uuid), $2=type (text: 'query' or 'response'), $3=content (text), $4=completed (boolean)
-- Returns: id and created_at
INSERT INTO simulation_messages (chat_id, type, content, completed, created_at)
VALUES ($1::uuid, $2::text, $3::text, $4::bool, NOW())
RETURNING id, created_at

