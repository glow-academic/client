-- Upsert assistant message and tool call for voice simulation
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_voice_progress_upsert_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_voice_progress_upsert_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_voice_progress_upsert_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function (no types needed for this function)
CREATE OR REPLACE FUNCTION socket_voice_progress_upsert_v4(
    chat_id uuid,
    run_id uuid,
    call_id text DEFAULT NULL,
    tool_name text DEFAULT NULL,
    arguments_raw text DEFAULT NULL,
    message_content text DEFAULT NULL,
    persona_id uuid DEFAULT NULL,
    parent_message_id uuid DEFAULT NULL,
    upload_id uuid DEFAULT NULL,
    message_id uuid DEFAULT NULL,
    is_complete boolean DEFAULT false
)
RETURNS TABLE (
    message_id text,
    tool_call_id text,
    final_content text,
    upload_linked boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id AS chat_id,
        run_id AS run_id,
        call_id AS call_id,
        tool_name AS tool_name,
        arguments_raw AS arguments_raw,
        message_content AS message_content,
        persona_id AS persona_id,
        parent_message_id AS parent_message_id,
        upload_id AS upload_id,
        message_id AS message_id,
        is_complete AS is_complete
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
    JOIN calls tc ON tc.call_id = p.call_id
    WHERE p.call_id IS NOT NULL
    LIMIT 1
),
create_tool_call_if_needed AS (
    INSERT INTO calls (call_id, tool_id, created_at, updated_at)
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
    INSERT INTO tool_call_arguments (tool_call_id, arguments_json, arguments_raw, created_at)
    SELECT 
        stc.tool_call_id,
        COALESCE(safe_jsonb_parse(p.arguments_raw), '{}'::jsonb),
        p.arguments_raw,
        NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    WHERE stc.tool_call_id IS NOT NULL
      AND p.arguments_raw IS NOT NULL
    ON CONFLICT (tool_call_id) 
    DO UPDATE SET 
        arguments_json = COALESCE(safe_jsonb_parse(EXCLUDED.arguments_raw), tool_call_arguments.arguments_json),
        arguments_raw = EXCLUDED.arguments_raw
    RETURNING tool_call_id
),
-- Finalize tool call if is_complete
finalize_tool_call AS (
    UPDATE calls
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
insert_content_if_needed AS (
    INSERT INTO content (content, created_at, updated_at)
    SELECT p.message_content, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.message_content IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_content mc 
          WHERE mc.message_id = sm.message_id 
          AND mc.idx = 0
      )
    RETURNING id as content_id, created_at, updated_at
),
insert_message_content_if_needed AS (
    INSERT INTO message_content (message_id, content_id, idx, created_at, updated_at)
    SELECT sm.message_id, ic.content_id, 0, ic.created_at, ic.updated_at
    FROM params p
    CROSS JOIN selected_message sm
    CROSS JOIN insert_content_if_needed ic
    WHERE p.message_content IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_content mc 
          WHERE mc.message_id = sm.message_id 
          AND mc.idx = 0
      )
),
update_message_content AS (
    UPDATE content
    SET content = p.message_content,
        updated_at = NOW()
    FROM params p,
         message_content mc
    WHERE mc.content_id = content.id
      AND mc.message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND mc.idx = 0
      AND p.message_content IS NOT NULL
),
-- Mark message as completed if is_complete
complete_message AS (
    UPDATE messages m
    SET completed = p_params.is_complete,
        updated_at = NOW()
    FROM params p_params
    WHERE m.id = (SELECT message_id FROM selected_message LIMIT 1)
      AND p_params.is_complete = true
    RETURNING m.id as message_id
),
-- Link message to run
link_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT sm.message_id, p_params.run_id, NOW(), NOW()
    FROM params p_params
    CROSS JOIN selected_message sm
    WHERE NOT EXISTS (
        SELECT 1 FROM message_runs mr 
        WHERE mr.message_id = sm.message_id 
        AND mr.run_id = p_params.run_id
    )
),
-- Link message to persona
link_message_to_persona AS (
    INSERT INTO message_personas (message_id, persona_id, created_at, updated_at)
    SELECT sm.message_id, p.persona_id, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.persona_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_personas mp 
          WHERE mp.message_id = sm.message_id 
          AND mp.persona_id = p.persona_id
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
$$;