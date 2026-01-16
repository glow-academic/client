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
    message_contents text DEFAULT NULL,
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
        message_contents AS message_contents,
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
    JOIN tool_artifact t ON (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) = p.tool_name AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
    WHERE p.tool_name IS NOT NULL
    LIMIT 1
),
-- Get or create tool call
get_existing_tool_call AS (
    SELECT tc.id as tool_call_id
    FROM params p
    JOIN calls tc ON tc.external_call_id = p.call_id
    WHERE p.call_id IS NOT NULL
    LIMIT 1
),
create_tool_call_if_needed AS (
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        p.call_id, 
        gt.tool_id, 
        (SELECT tao.args_outputs_id FROM tool_args_outputs tao WHERE tao.tool_id = gt.tool_id LIMIT 1),
        COALESCE(p.arguments_raw, ''),
        false,
        NOW(), 
        NOW()
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
-- Update arguments_raw on calls if provided (arguments_raw is now a direct column)
update_call_arguments AS (
    UPDATE calls
    SET arguments_raw = COALESCE((SELECT p.arguments_raw FROM params p LIMIT 1), ''), updated_at = NOW()
    WHERE id IN (SELECT tool_call_id FROM selected_tool_call)
      AND (SELECT p.arguments_raw FROM params p LIMIT 1) IS NOT NULL 
      AND (SELECT p.arguments_raw FROM params p LIMIT 1) != ''
    RETURNING calls.id
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
-- Link call to message via message_calls (run_id removed from calls table)
link_call_to_message AS (
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    SELECT 
        uuid(sm.message_id),
        stc.tool_call_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    CROSS JOIN selected_message sm
    ON CONFLICT (message_id, call_id) DO NOTHING
),
-- Insert or UPDATE messages content
insert_content_if_needed AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT p.message_contents, NOW(), NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.message_contents IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_contents mc 
          WHERE mc.message_id = sm.message_id 
          AND mc.idx = 0
      )
    RETURNING id as content_id, created_at, updated_at
),
insert_message_content_if_needed AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT sm.message_id, ic.content_id, 0, ic.created_at, ic.updated_at
    FROM params p
    CROSS JOIN selected_message sm
    CROSS JOIN insert_content_if_needed ic
    WHERE p.message_contents IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_contents mc 
          WHERE mc.message_id = sm.message_id 
          AND mc.idx = 0
      )
),
update_message_content AS (
    UPDATE contents
    SET content = p.message_contents,
        updated_at = NOW()
    FROM params p,
         message_contents mc
    WHERE mc.content_id = contents.id
      AND mc.message_id = (SELECT message_id FROM selected_message LIMIT 1)
      AND mc.idx = 0
      AND p.message_contents IS NOT NULL
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
-- Create audio record and link to upload if upload_id provided
create_audio_if_provided_voice AS (
    INSERT INTO audios_resource (created_at, updated_at, active, generated, call_id)
    SELECT NOW(), NOW(), true, false, NULL
    FROM params p
    WHERE p.upload_id IS NOT NULL
    RETURNING id as audio_id
),
link_audio_upload_voice AS (
    INSERT INTO audio_uploads (audio_id, upload_id, active, created_at, updated_at)
    SELECT ca.audio_id, p.upload_id, true, NOW(), NOW()
    FROM create_audio_if_provided_voice ca
    CROSS JOIN params p
    WHERE p.upload_id IS NOT NULL
),
link_audio_to_message AS (
    INSERT INTO message_audios (message_id, audio_id, created_at, updated_at)
    SELECT uuid(sm.message_id), ca.audio_id, NOW(), NOW()
    FROM create_audio_if_provided_voice ca
    CROSS JOIN selected_message sm
    CROSS JOIN params p
    WHERE p.upload_id IS NOT NULL
    RETURNING audio_id
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1)::text as tool_call_id,
    (SELECT message_contents FROM params LIMIT 1) as final_content,
    (SELECT EXISTS(SELECT 1 FROM link_audio_to_message)) as upload_linked
$$;