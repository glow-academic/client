-- Finalize message and tool call
-- Parameters:
--   $1=chat_id (uuid)
--   $2=run_id (uuid)
--   $3=tool_call_id (uuid, nullable - if provided, finalize tool call)
--   $4=call_id (text, nullable - for tool call identification)
--   $5=message_id (uuid, nullable - if provided, finalize this message; otherwise get from tool_call)
--   $6=final_content (text - final message content)
--   $7=persona_id (uuid, nullable - for persona linking)
-- Returns: message_id (uuid as text), final_content (text), completed (boolean)
--
-- This function:
-- 1. Finalizes tool call (marks as completed, updates arguments)
-- 2. Finalizes message (marks as completed, updates final content)
-- 3. Links message to persona if provided
WITH params AS (
    SELECT 
        $1::uuid as chat_id,
        $2::uuid as run_id,
        $3::uuid as tool_call_id,
        $4::text as call_id,
        $5::uuid as message_id,
        $6::text as final_content,
        $7::uuid as persona_id
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
    SELECT DISTINCT m.id as message_id
    FROM get_tool_call gtc
    JOIN tool_call_runs tcr ON tcr.tool_call_id = gtc.tool_call_id
    JOIN message_runs mr ON mr.run_id = tcr.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role = message_role.assistant
    ORDER BY m.created_at DESC
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
    UPDATE message_content
    SET content = p.final_content,
        updated_at = NOW()
    FROM params p
    WHERE message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND idx = 0
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
    INSERT INTO message_personas (message_id, persona_id, active, created_at, updated_at)
    SELECT 
        (SELECT message_id FROM selected_message LIMIT 1),
        p.persona_id,
        true,
        NOW(),
        NOW()
    FROM params p
    WHERE p.persona_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_personas mp 
          WHERE mp.message_id = (SELECT message_id FROM selected_message LIMIT 1)
          AND mp.persona_id = p.persona_id 
          AND mp.active = true
      )
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT final_content FROM params LIMIT 1) as final_content,
    (SELECT completed FROM complete_message LIMIT 1) as completed

