-- Update member tool call progress - creates/updates tool_call and message incrementally
-- Handles speak tool only (instruct and prompt moved to prompt agent)
-- Converted to PostgreSQL function pattern
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_member_tool_progress_update_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_member_tool_progress_update_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_member_tool_progress_update_v4(
    chat_id uuid,
    run_id uuid,
    tool_call_id text,
    call_id text,
    tool_name text,
    token text,
    accumulated_content text,
    arguments_raw text,
    message_id uuid DEFAULT NULL,
    parent_message_id uuid DEFAULT NULL
)
RETURNS TABLE (
    message_id text,
    tool_call_id text,
    accumulated_content text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        chat_id, run_id, tool_call_id, call_id, tool_name, 
        token, accumulated_content, arguments_raw, message_id, parent_message_id
),
-- Get tool_id from tool_name
get_tool_id AS (
    SELECT id as tool_id
    FROM tools
    WHERE name = (SELECT tool_name FROM params LIMIT 1)
      AND agent_role = 'member'::agent_role
      AND active = true
    LIMIT 1
),
-- Determine message role - member agent only handles speak (assistant role)
message_role AS (
    SELECT 'assistant'::message_role as role
),
-- Get or create tool_call
existing_tool_call AS (
    SELECT tc.id as tool_call_id
    FROM params p
    JOIN tool_calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.call_id = p.call_id)
    )
    LIMIT 1
),
create_tool_call AS (
    INSERT INTO tool_calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 
        COALESCE(p.call_id, 'member_' || p.tool_call_id),
        gt.tool_id,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN get_tool_id gt
    WHERE NOT EXISTS (SELECT 1 FROM existing_tool_call)
    RETURNING id as tool_call_id, call_id
),
selected_tool_call AS (
    SELECT tool_call_id::text, call_id FROM existing_tool_call
    UNION ALL
    SELECT tool_call_id::text, call_id FROM create_tool_call
),
-- Link tool_call to run
link_tool_call_to_run AS (
    INSERT INTO tool_call_runs (tool_call_id, run_id, created_at, updated_at)
    SELECT 
        uuid(stc.tool_call_id),
        p.run_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    ON CONFLICT (tool_call_id, run_id) DO UPDATE SET updated_at = NOW()
),
-- Get or create message
existing_message AS (
    SELECT p.message_id::uuid as message_id
    FROM params p
    WHERE p.message_id IS NOT NULL
    UNION ALL
    SELECT m.id as message_id
    FROM params p
    JOIN selected_tool_call stc ON true
    JOIN message_content mc ON mc.tool_call_id = uuid(stc.tool_call_id)
    JOIN messages m ON m.id = mc.message_id
    WHERE p.message_id IS NULL
    LIMIT 1
),
create_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 
        mr.role,
        false,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN message_role mr
    WHERE NOT EXISTS (SELECT 1 FROM existing_message)
    RETURNING id as message_id
),
selected_message AS (
    SELECT message_id FROM existing_message
    UNION ALL
    SELECT message_id FROM create_message
),
-- Create or update message_content
upsert_message_content AS (
    INSERT INTO message_content (message_id, idx, content, tool_call_id, created_at, updated_at)
    SELECT 
        uuid(sm.message_id),
        0,
        p.accumulated_content,
        uuid(stc.tool_call_id),
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    CROSS JOIN selected_tool_call stc
    WHERE NOT EXISTS (
        SELECT 1 FROM message_content mc 
        WHERE mc.message_id = uuid(sm.message_id) AND mc.idx = 0
    )
    ON CONFLICT (message_id, idx) DO UPDATE SET
        content = EXCLUDED.content,
        updated_at = NOW()
),
-- Link message to run
link_message_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT 
        uuid(sm.message_id),
        p.run_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
),
-- Create branch if parent_message_id provided
create_branch AS (
    INSERT INTO message_tree (parent_id, child_id, active, created_at, updated_at)
    SELECT 
        p.parent_message_id,
        uuid(sm.message_id),
        true,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.parent_message_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_tree mt 
          WHERE mt.parent_id = p.parent_message_id 
          AND mt.child_id = uuid(sm.message_id)
          AND mt.active = true
      )
)
SELECT 
    (SELECT message_id FROM selected_message LIMIT 1)::text as message_id,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1)::text as tool_call_id,
    (SELECT accumulated_content FROM params LIMIT 1) as accumulated_content
$$;

