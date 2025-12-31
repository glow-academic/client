-- Get all messages for a run, formatted for agent input
-- Parameters: $1=run_id (uuid)
-- Returns: JSONB array of messages with role and content fields
-- Messages are in TResponseInputItem format: {"role": "user"|"assistant"|"developer", "content": "..."}
WITH run_messages AS (
    SELECT 
        m.role,
        mc.content,
        m.created_at
    FROM messages m
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = m.id
    WHERE mr.run_id = $1::uuid
    ORDER BY m.created_at ASC
)
SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'role', role,
            'content', content
        ) ORDER BY created_at
    ),
    '[]'::jsonb
) as messages
FROM run_messages

