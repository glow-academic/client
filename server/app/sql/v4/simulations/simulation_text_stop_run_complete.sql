-- Stop a simulation run by marking the latest message completed
-- Parameters: $1=chat_id (uuid)
-- Returns: success (boolean), cancelled_message_id (uuid), final_content (text)
WITH params AS (
    SELECT $1::uuid as chat_id
),
latest_message AS (
    SELECT
        m.id,
        COALESCE(mc.content, '') as content
    FROM chats c
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN runs r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN messages m ON m.id = mr.message_id
    LEFT JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    WHERE c.id = (SELECT chat_id FROM params)
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt
          WHERE mt.parent_id = m.id AND mt.active = true
      )
    ORDER BY m.created_at DESC
    LIMIT 1
),
update_message AS (
    UPDATE messages
    SET completed = TRUE,
        updated_at = NOW()
    WHERE id = (SELECT id FROM latest_message)
    RETURNING id
)
SELECT
    (SELECT id FROM update_message) IS NOT NULL as success,
    (SELECT id FROM update_message) as cancelled_message_id,
    (SELECT content FROM latest_message) as final_content;
