DROP FUNCTION IF EXISTS api_text_complete_finalize_v4(uuid, uuid, uuid, text, uuid, text, uuid);
CREATE OR REPLACE FUNCTION api_text_complete_finalize_v4(
    chat_id uuid,
    run_id uuid,
    tool_call_id uuid,
    call_id text,
    message_id uuid,
    final_content text,
    persona_id uuid
)
RETURNS TABLE (
    message_id text,
    final_content text,
    completed boolean
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT 
        api_text_complete_finalize_v4.chat_id as chat_id,
        api_text_complete_finalize_v4.run_id as run_id,
        api_text_complete_finalize_v4.tool_call_id as tool_call_id,
        api_text_complete_finalize_v4.call_id as call_id,
        api_text_complete_finalize_v4.message_id as message_id,
        api_text_complete_finalize_v4.final_content as final_content,
        api_text_complete_finalize_v4.persona_id as persona_id
),
-- Get tool call if tool_call_id or call_id provided
get_tool_call AS (
    SELECT tc.id as tool_call_id
    FROM params p
    JOIN tool_calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.call_id = p.call_id)
    )
    LIMIT 1
),
-- Finalize tool call
finalize_tool_call AS (
    UPDATE tool_calls
    SET completed = true,
        updated_at = NOW()
    FROM get_tool_call gtc
    WHERE tool_calls.id = gtc.tool_call_id
    RETURNING id as tool_call_id
),
-- Get message from tool_call or use provided message_id
get_message_from_tool_call AS (
    SELECT DISTINCT ON (m.id) m.id as message_id
    FROM get_tool_call gtc
    JOIN tool_call_runs tcr ON tcr.tool_call_id = gtc.tool_call_id
    JOIN message_runs mr ON mr.run_id = tcr.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role = 'assistant'::message_role
    ORDER BY m.id, m.created_at DESC
    LIMIT 1
),
selected_message AS (
    SELECT message_id FROM get_message_from_tool_call
    WHERE EXISTS (SELECT 1 FROM get_tool_call)
    UNION ALL
    SELECT message_id FROM params
    WHERE message_id IS NOT NULL
),
-- Update message content with final content
update_message_content_final AS (
    UPDATE message_content mc
    SET content = p.final_content,
        updated_at = NOW()
    FROM params p
    WHERE mc.message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND mc.idx = 0
),
-- Mark message as completed
complete_message AS (
    UPDATE messages
    SET completed = true,
        updated_at = NOW()
    WHERE id = (SELECT message_id FROM selected_message LIMIT 1)
    RETURNING id as message_id, completed
),
-- Link message to persona if provided
link_message_to_persona AS (
    INSERT INTO message_personas (message_id, persona_id, created_at, updated_at)
    SELECT 
        (SELECT message_id FROM selected_message LIMIT 1),
        p.persona_id,
        NOW(),
        NOW()
    FROM params p
    WHERE p.persona_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_personas mp 
          WHERE mp.message_id = (SELECT message_id FROM selected_message LIMIT 1)
          AND mp.persona_id = p.persona_id
      )
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT final_content FROM params LIMIT 1) as final_content,
    (SELECT completed FROM complete_message LIMIT 1) as completed
$$;