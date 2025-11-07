-- Verify that an assistant chat exists
-- Parameters: $1=chat_id (uuid)
-- Returns: id if chat exists, or no rows if chat doesn't exist
SELECT id::text
FROM assistant_chats
WHERE id = $1::uuid

