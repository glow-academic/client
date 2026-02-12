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
        me.id,
        COALESCE(ce.content, '') as content
    FROM simulation_chats_entry c
    JOIN simulation_messages_entry sm ON sm.chat_id = c.id
    JOIN messages_entry me ON me.id = sm.message_id
    LEFT JOIN LATERAL (
        SELECT content
        FROM simulation_contents_entry ce
        WHERE ce.message_id = me.id
          AND ce.active = true
        ORDER BY ce.created_at
        LIMIT 1
    ) ce ON TRUE
    WHERE c.id = (SELECT chat_id FROM params)
      AND NOT EXISTS (
          SELECT 1 FROM simulation_message_tree_entry mt
          WHERE mt.parent_id = me.id AND mt.active = true
      )
    ORDER BY me.created_at DESC
    LIMIT 1
),
update_message AS (
    UPDATE messages_entry
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
