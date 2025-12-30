-- Upsert assistant message and tool call for voice simulation
-- Parameters:
--   $1=chat_id (uuid)
--   $2=run_id (uuid)
--   $3=call_id (text - tool call identifier from Realtime API)
--   $4=tool_name (text - tool name, typically "speak")
--   $5=arguments_raw (text - JSON string of tool call arguments)
--   $6=message_content (text - extracted message content from arguments)
--   $7=persona_id (uuid, nullable - resolved persona ID)
--   $8=parent_message_id (uuid, nullable - for message branching)
--   $9=upload_id (uuid, nullable - for audio linking)
--   $10=message_id (uuid, nullable - if provided, update existing message; otherwise create new)
--   $11=is_complete (boolean - true if this is final update, false for incremental)
-- Returns: message_id (uuid as text), tool_call_id (uuid as text), final_content (text), upload_linked (boolean)
--
-- This function:
-- 1. Gets or creates tool call (by call_id)
-- 2. Gets or creates assistant message (by message_id or creates new)
-- 3. Updates message content incrementally or with final content
-- 4. Updates tool call arguments incrementally or with final arguments
-- 5. Links message to run (atomic)
-- 6. Links tool call to run (atomic)
-- 7. Links audio upload to message if upload_id provided
-- 8. Links message to persona if persona_id provided
-- 9. Creates message branch if parent_message_id provided
WITH params AS (
    SELECT 
        $1::uuid as chat_id,
        $2::uuid as run_id,
        $3::text as call_id,
        $4::text as tool_name,
        $5::text as arguments_raw,
        $6::text as message_content,
        $7::uuid as persona_id,
        $8::uuid as parent_message_id,
        $9::uuid as upload_id,
        $10::uuid as message_id,
        $11::boolean as is_complete
),
-- Get tool_id by tool_name
get_tool_id AS (
    SELECT id as tool_id
    FROM params p
    JOIN tools t ON t.name = p.tool_name AND t.active = true
    WHERE p.tool_name IS NOT NULL
    LIMIT 1
),
-- Get or create tool call
get_existing_tool_call AS (
    SELECT tc.id as tool_call_id
    FROM params p
    JOIN tool_calls tc ON tc.call_id = p.call_id
    WHERE p.call_id IS NOT NULL
    LIMIT 1
),
create_tool_call_if_needed AS (
    INSERT INTO tool_calls (call_id, tool_id, created_at, updated_at)
    SELECT p.call_id, gt.tool_id, NOW(), NOW()
    FROM params p
    CROSS JOIN get_tool_id gt
    WHERE p.call_id IS NOT NULL
      AND gt.tool_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM get_existing_tool_call)
    RETURNING id as tool_call_id
),
selected_tool_call AS (
    SELECT tool_call_id FROM get_existing_tool_call
    UNION ALL
    SELECT tool_call_id FROM create_tool_call_if_needed
),
-- Link tool call to run
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
-- Update tool call arguments
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
-- Finalize tool call if is_complete
finalize_tool_call AS (
    UPDATE tool_calls
    SET completed = p.is_complete,
        updated_at = NOW()
    FROM params p
    WHERE id = (SELECT tool_call_id FROM selected_tool_call LIMIT 1)
      AND p.is_complete = true
    RETURNING id as tool_call_id
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
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'assistant'::message_role, p.is_complete, true, NOW(), NOW()
    FROM params p
    WHERE p.message_id IS NULL
      AND p.call_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM get_existing_message)
    RETURNING id as message_id, created_at, updated_at
),
selected_message AS (
    SELECT message_id FROM get_existing_message
    UNION ALL
    SELECT message_id FROM create_message_if_needed
),
-- Insert or update message content
insert_message_content_if_needed AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT sm.message_id, 0, p.message_content, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.message_content IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_content mc 
          WHERE mc.message_id = sm.message_id 
          AND mc.idx = 0
      )
),
update_message_content AS (
    UPDATE message_content
    SET content = p.message_content,
        updated_at = NOW()
    FROM params p
    WHERE message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND idx = 0
      AND p.message_content IS NOT NULL
),
-- Mark message as completed if is_complete
complete_message AS (
    UPDATE messages
    SET completed = p.is_complete,
        updated_at = NOW()
    FROM params p
    WHERE id = (SELECT message_id FROM selected_message LIMIT 1)
      AND p.is_complete = true
    RETURNING id as message_id
),
-- Link message to run
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
-- Link message to persona
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
-- Create message branch
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
),
-- Link audio upload to message
link_audio_to_message AS (
    INSERT INTO message_audio (message_id, upload_id, created_at, updated_at)
    SELECT sm.message_id, p.upload_id, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.upload_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_audio ma 
          WHERE ma.message_id = sm.message_id 
          AND ma.upload_id = p.upload_id
      )
    RETURNING upload_id
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1)::text as tool_call_id,
    (SELECT message_content FROM params LIMIT 1) as final_content,
    (SELECT EXISTS(SELECT 1 FROM link_audio_to_message)) as upload_linked

