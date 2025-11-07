-- Stop simulation run: mark incomplete message complete and return cancelled message info
-- Parameters: $1=chat_id (uuid)
-- Returns: cancelled_message_id (uuid), final_content (text), success (boolean)
WITH get_incomplete_message AS (
    -- Get first incomplete response message for the chat
    SELECT id, content
    FROM simulation_messages
    WHERE chat_id = $1::uuid AND type = 'response' AND completed = false
    ORDER BY created_at DESC
    LIMIT 1
),
update_message AS (
    -- Mark message as completed
    UPDATE simulation_messages 
    SET completed = true 
    WHERE id IN (SELECT id FROM get_incomplete_message)
    RETURNING id as cancelled_message_id, content as final_content
)
SELECT 
    COALESCE(um.cancelled_message_id::text, NULL) as cancelled_message_id,
    COALESCE(um.final_content, '') as final_content,
    CASE WHEN um.cancelled_message_id IS NOT NULL THEN true ELSE false END as success
FROM update_message um
UNION ALL
SELECT NULL, '', false
WHERE NOT EXISTS (SELECT 1 FROM update_message)

