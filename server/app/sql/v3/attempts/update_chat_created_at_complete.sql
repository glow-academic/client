-- Update chat created_at timestamp with existence check in a single transaction
-- Parameters: $1=createdAt (timestamp), $2=chatId
-- Returns: chat_id if updated, or no rows if chat doesn't exist
WITH chat_exists AS (
    -- Check if chat exists
    SELECT id
    FROM chats
    WHERE id = $2::uuid
),
update_chat AS (
    -- Update the createdAt timestamp only if chat exists
    UPDATE chats
    SET created_at = $1,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM chat_exists)
    RETURNING id::text as chat_id
)
SELECT chat_id FROM update_chat

