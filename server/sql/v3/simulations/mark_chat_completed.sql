-- Mark simulation chat as completed
-- Parameters: $1=chat_id (uuid)
UPDATE simulation_chats
SET completed = true
WHERE id = $1::uuid

