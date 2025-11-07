-- Update assistant chat title
-- Parameters: $1=chat_id (uuid), $2=title (text)
UPDATE assistant_chats 
SET title = $2::text, updated_at = NOW()
WHERE id = $1::uuid

