-- Get a specific chat by ID
-- Parameters: $1 = chat_id (uuid)
SELECT 
    id,
    created_at,
    updated_at,
    profile_id,
    title,
    trace_id
FROM assistant_chats
WHERE id = $1

