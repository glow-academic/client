-- Get all chats for a profile
-- Parameters: $1 = profile_id (uuid)
SELECT 
    id,
    created_at,
    updated_at,
    profile_id,
    title,
    trace_id
FROM assistant_chats
WHERE profile_id = $1
ORDER BY created_at DESC

