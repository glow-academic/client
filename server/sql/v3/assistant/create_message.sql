-- Create an assistant message
-- Parameters: $1=chat_id (uuid), $2=role (text: 'user' or 'assistant'), $3=content (text), $4=completed (boolean), $5=created_at (timestamp with time zone)
-- Returns: id and created_at
INSERT INTO assistant_messages (chat_id, role, content, completed, created_at)
VALUES ($1::uuid, $2::text, $3::text, $4::bool, $5::timestamp with time zone)
RETURNING id, created_at

