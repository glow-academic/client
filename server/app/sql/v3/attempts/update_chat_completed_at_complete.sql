-- Update chat completed flag with existence check in a single transaction
-- Parameters: $1=chatId (uuid)
-- Returns: chat_id if updated, or no rows if chat doesn't exist
WITH chat_exists AS (
    -- Check if chat exists
    SELECT id
    FROM chats
    WHERE id = $1::uuid
),
update_chat AS (
    -- Update the completed flag only if chat exists
    UPDATE chats
    SET completed = true,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM chat_exists)
    RETURNING id::text as chat_id
)
SELECT chat_id FROM update_chat

