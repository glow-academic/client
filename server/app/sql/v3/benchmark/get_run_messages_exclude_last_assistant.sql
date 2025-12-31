-- Get messages from a run, excluding the last assistant output
-- Parameters: $1=run_id (uuid)
-- Returns: messages (jsonb array) - all messages except the last assistant message
-- Used in dynamic mode to regenerate the last assistant response
WITH run_messages AS (
    SELECT 
        m.role,
        mc.content,
        m.created_at,
        ROW_NUMBER() OVER (ORDER BY m.created_at DESC) as rn_desc,
        COUNT(*) FILTER (WHERE m.role = 'assistant') OVER () as total_assistants,
        SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) OVER (ORDER BY m.created_at DESC) as assistants_from_end
    FROM messages m
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN message_runs mr ON mr.message_id = m.id
    WHERE mr.run_id = $1::uuid
      AND m.role IN ('user', 'assistant', 'system', 'developer')
)
SELECT COALESCE(
    jsonb_agg(
        jsonb_build_object(
            'role', role,
            'content', content
        ) ORDER BY created_at ASC
    ),
    '[]'::jsonb
) as messages
FROM run_messages
WHERE NOT (role = 'assistant' AND assistants_from_end = 1)

