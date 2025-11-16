-- Insert an error message in assistant chat
-- Parameters: $1=chat_id (uuid), $2=content (text), $3=completed (boolean)
-- Returns: all columns
INSERT INTO assistant_messages 
(chat_id, role, content, completed, created_at)
VALUES ($1::uuid, 'assistant'::assistant_message_type, $2::text, $3::bool, NOW())
RETURNING *

