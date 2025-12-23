-- Link an existing chat to an attempt via junction table
-- Parameters: $1=attempt_id (uuid), $2=chat_id (uuid)
-- Returns: attempt_id, chat_id
INSERT INTO attempt_chats (attempt_id, chat_id, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, NOW(), NOW())
ON CONFLICT (attempt_id, chat_id) DO NOTHING
RETURNING attempt_id, chat_id

