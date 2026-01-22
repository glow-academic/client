DROP FUNCTION IF EXISTS api_simulation_text_stop_run_v4(uuid);
CREATE OR REPLACE FUNCTION api_simulation_text_stop_run_v4(
    chat_id uuid
)
RETURNS TABLE (
    success boolean,
    cancelled_message_id uuid,
    final_content text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT api_simulation_text_stop_run_v4.chat_id as chat_id
),
latest_message AS (
    SELECT
        m.id,
        COALESCE(ce.content, '') as content
    FROM chats c
    JOIN groups g ON g.id = c.group_id
    JOIN runs r ON r.group_id = g.id
    JOIN messages m ON m.run_id = r.id
    LEFT JOIN contents_entry ce ON ce.message_id = m.id AND ce.idx = 0
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
    (SELECT content FROM latest_message) as final_content
$$;