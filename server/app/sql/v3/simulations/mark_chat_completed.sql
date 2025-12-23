-- Mark chat as completed
-- Parameters: $1=chat_id (uuid)
UPDATE chats
SET completed = true,
    updated_at = NOW()
WHERE id = $1::uuid

