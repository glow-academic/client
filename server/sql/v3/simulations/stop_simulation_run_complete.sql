-- Stop simulation run: mark incomplete message complete and return cancelled message info
-- Parameters: $1=chat_id (uuid)
-- Returns: cancelled_message_id (uuid), final_content (text), success (boolean)
WITH get_incomplete_message AS (
    -- Get first incomplete assistant message for the chat
    SELECT m.id, m.content
    FROM messages m
    JOIN message_runs mr ON mr.message_id = m.id
    JOIN chat_runs rc ON rc.run_id = mr.run_id
    WHERE rc.chat_id = $1::uuid AND m.role = 'assistant' AND m.completed = false
    ORDER BY m.created_at DESC
    LIMIT 1
),
update_message AS (
    -- Mark message as completed
    UPDATE messages 
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

