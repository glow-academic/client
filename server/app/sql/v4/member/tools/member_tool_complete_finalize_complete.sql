-- Finalize member tool call - marks tool_call and message as completed
-- Handles speak tool only (instruct and prompt moved to prompt agent)
-- Converted to PostgreSQL function pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_member_tool_complete_finalize_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_member_tool_complete_finalize_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_member_tool_complete_finalize_v4(
    chat_id uuid,
    run_id uuid,
    tool_call_id text,
    call_id text,
    message_id uuid,
    final_content text
)
RETURNS TABLE (
    message_id text,
    final_content text,
    completed boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id, run_id, tool_call_id, call_id, message_id, final_content
),
-- Get tool call if tool_call_id or call_id provided
get_tool_call AS (
    SELECT tc.id as tool_call_id
    FROM params p
    JOIN calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.external_call_id = p.call_id)
    )
    LIMIT 1
),
-- Finalize tool call
finalize_tool_call AS (
    UPDATE calls
    SET completed = true,
        updated_at = NOW()
    FROM get_tool_call gtc
    WHERE calls.id = gtc.tool_call_id
    RETURNING id as tool_call_id
),
-- Get message from tool_call or use provided message_id
get_message_from_tool_call AS (
    SELECT DISTINCT ON (m.id) m.id as message_id
    FROM get_tool_call gtc
    JOIN calls tc ON tc.id = gtc.tool_call_id
    JOIN message_calls mc ON mc.call_id = tc.id
    JOIN messages m ON m.id = mc.message_id
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
-- UPDATE messages content with final content
update_message_content_final AS (
    UPDATE contents
    SET content = p.final_content,
        updated_at = NOW()
    FROM params p,
         message_contents mc
    WHERE mc.content_id = contents.id
      AND mc.message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND mc.idx = 0
),
-- Mark message as completed
complete_message AS (
    UPDATE messages
    SET completed = true,
        updated_at = NOW()
    WHERE id = (SELECT message_id FROM selected_message LIMIT 1)
    RETURNING id as message_id, completed
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT final_content FROM params LIMIT 1) as final_content,
    (SELECT completed FROM complete_message LIMIT 1) as completed
$$;

