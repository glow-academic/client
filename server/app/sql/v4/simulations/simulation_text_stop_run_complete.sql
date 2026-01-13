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
        COALESCE(cnt.content, '') as content
    FROM chat_artifact c
    JOIN chat_groups cg ON cg.chat_id = c.id
    JOIN groups g ON g.id = cg.group_id
    JOIN group_runs gr ON gr.group_id = g.id
    JOIN run_artifact r ON r.id = gr.run_id
    JOIN message_runs mr ON mr.run_id = r.id
    JOIN message_artifact m ON m.id = mr.message_id
    LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
    WHERE c.id = (SELECT chat_id FROM params)
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt
          WHERE mt.parent_id = m.id AND mt.active = true
      )
    ORDER BY m.created_at DESC
    LIMIT 1
),
update_message AS (
    UPDATE message_artifact
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