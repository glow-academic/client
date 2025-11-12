-- Insert an error message in simulation chat
-- Parameters: $1=chat_id (uuid), $2=type (simulation_message_type: 'query' or 'response'), $3=content (text), $4=completed (boolean)
-- Returns: all columns
INSERT INTO simulation_messages 
(chat_id, type, content, completed, created_at)
VALUES ($1::uuid, $2::simulation_message_type, $3::text, $4::bool, NOW())
RETURNING *

