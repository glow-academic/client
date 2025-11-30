-- Insert an error message in simulation chat
-- Parameters: $1=chat_id (uuid), $2=type (message_role: 'query' or 'response'), $3=content (text), $4=completed (boolean)
-- Returns: all columns
INSERT INTO messages 
(chat_id, type, content, completed, created_at)
VALUES ($1::uuid, $2::message_role, $3::text, $4::bool, NOW())
RETURNING *

