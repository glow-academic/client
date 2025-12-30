-- Update message content and tool call arguments incrementally
-- Parameters: 
--   $1=chat_id (uuid)
--   $2=run_id (uuid)
--   $3=tool_call_id (text, nullable - if provided, update tool call; otherwise update message)
--   $4=call_id (text, nullable - for tool call identification)
--   $5=tool_name (text, nullable - for tool call creation)
--   $6=token (text - new token content)
--   $7=accumulated_content (text - full accumulated content)
--   $8=arguments_raw (text, nullable - for tool call arguments)
--   $9=message_id (uuid, nullable - if provided, update existing message; otherwise create new)
--   $10=parent_message_id (uuid, nullable - for message branching)
--   $11=persona_id (uuid, nullable - for persona linking)
-- Returns: message_id (uuid as text), tool_call_id (uuid as text, nullable), accumulated_content (text)
--
-- This function:
-- 1. Creates or updates tool call if tool_call_id/call_id provided
-- 2. Creates or updates message if message_id provided or if tool_call_id provided
-- 3. Updates message content incrementally
-- 4. Updates tool call arguments incrementally
-- 5. Links message to run
-- 6. Links message to persona if provided
-- 7. Creates message branch if parent_message_id provided
WITH params AS (
    SELECT 
        $1::uuid as chat_id,
        $2::uuid as run_id,
        $3::text as tool_call_id_str,
        $4::text as call_id,
        $5::text as tool_name,
        $6::text as token,
        $7::text as accumulated_content,
        $8::text as arguments_raw,
        $9::uuid as message_id,
        $10::uuid as parent_message_id,
        $11::uuid as persona_id
),
-- Get or create tool call if tool_call_id/call_id provided
get_tool_id AS (
    SELECT id as tool_id
    FROM params p
    JOIN tools t ON t.name = p.tool_name AND t.active = true
    WHERE p.tool_name IS NOT NULL
    LIMIT 1
),
create_tool_call_if_needed AS (
    INSERT INTO tool_calls (call_id, tool_id, created_at, updated_at)
    SELECT p.call_id, gt.tool_id, NOW(), NOW()
    FROM params p
    CROSS JOIN get_tool_id gt
    WHERE p.tool_call_id_str IS NULL 
      AND p.call_id IS NOT NULL
      AND gt.tool_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM tool_calls tc WHERE tc.call_id = p.call_id
      )
    RETURNING id as tool_call_id, call_id
),
get_tool_call AS (
    SELECT id as tool_call_id, call_id
    FROM params p
    JOIN tool_calls tc ON tc.call_id = p.call_id
    WHERE p.call_id IS NOT NULL
    LIMIT 1
),
selected_tool_call AS (
    SELECT tool_call_id, call_id FROM create_tool_call_if_needed
    UNION ALL
    SELECT tool_call_id, call_id FROM get_tool_call
),
link_tool_call_to_run AS (
    INSERT INTO tool_call_runs (tool_call_id, run_id, created_at, updated_at)
    SELECT stc.tool_call_id, p.run_id, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    WHERE stc.tool_call_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM tool_call_runs tcr 
          WHERE tcr.tool_call_id = stc.tool_call_id 
          AND tcr.run_id = p.run_id
      )
),
update_tool_call_arguments AS (
    INSERT INTO tool_call_arguments (tool_call_id, arguments_json, arguments_raw, created_at, updated_at)
    SELECT 
        stc.tool_call_id,
        COALESCE(safe_jsonb_parse(p.arguments_raw), '{}'::jsonb),
        p.arguments_raw,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    WHERE stc.tool_call_id IS NOT NULL
      AND p.arguments_raw IS NOT NULL
    ON CONFLICT (tool_call_id) 
    DO UPDATE SET 
        arguments_json = COALESCE(safe_jsonb_parse(p.arguments_raw), tool_call_arguments.arguments_json),
        arguments_raw = p.arguments_raw,
        updated_at = NOW()
    RETURNING tool_call_id
),
-- Get or create message
get_existing_message AS (
    SELECT m.id as message_id
    FROM params p
    JOIN messages m ON m.id = p.message_id
    WHERE p.message_id IS NOT NULL
    LIMIT 1
),
create_message_if_needed AS (
    INSERT INTO messages (role, completed, created_at, updated_at)
    SELECT 'assistant'::message_role, false, NOW(), NOW()
    FROM params p
    WHERE p.message_id IS NULL
      AND (p.tool_call_id_str IS NOT NULL OR p.call_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM get_existing_message)
    RETURNING id as message_id, created_at, updated_at
),
selected_message AS (
    SELECT message_id FROM get_existing_message
    UNION ALL
    SELECT message_id FROM create_message_if_needed
),
insert_message_content_if_needed AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT sm.message_id, 0, p.accumulated_content, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE NOT EXISTS (
        SELECT 1 FROM message_content mc 
        WHERE mc.message_id = sm.message_id 
        AND mc.idx = 0
    )
),
update_message_content AS (
    UPDATE message_content
    SET content = p.accumulated_content,
        updated_at = NOW()
    FROM params p
    WHERE message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND idx = 0
),
link_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sm.message_id, p.run_id, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE NOT EXISTS (
        SELECT 1 FROM message_runs mr 
        WHERE mr.message_id = sm.message_id 
        AND mr.run_id = p.run_id
    )
),
link_message_to_persona AS (
    INSERT INTO message_personas (message_id, persona_id, active, created_at, updated_at)
    SELECT sm.message_id, p.persona_id, true, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.persona_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_personas mp 
          WHERE mp.message_id = sm.message_id 
          AND mp.persona_id = p.persona_id 
          AND mp.active = true
      )
),
create_message_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT 
        p.parent_message_id,
        sm.message_id as child_id,
        true,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.parent_message_id IS NOT NULL
      AND p.parent_message_id != sm.message_id
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = p.parent_message_id 
          AND mt.child_id = sm.message_id 
          AND mt.active = true
      )
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1)::text as tool_call_id,
    (SELECT accumulated_content FROM params LIMIT 1) as accumulated_content

