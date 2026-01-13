-- UPDATE simulation_artifact tool call progress - creates/updates tool_call and message incrementally
-- Handles speak tool with persona support
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
        WHERE proname = 'socket_simulation_tool_progress_update_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_simulation_tool_progress_update_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_simulation_tool_progress_update_v4(
    chat_id uuid,
    run_id uuid,
    tool_call_id text,
    call_id text,
    tool_name text,
    token text,
    accumulated_content text,
    arguments_raw text,
    message_id uuid DEFAULT NULL,
    parent_message_id uuid DEFAULT NULL,
    persona_id uuid DEFAULT NULL
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
        token, accumulated_content, arguments_raw, message_id, parent_message_id, persona_id
),
-- Get tool_id from tool_name
get_tool_id AS (
    SELECT t.id as tool_id
    FROM tool_artifact t
    WHERE t.name = (SELECT tool_name FROM params LIMIT 1)
      AND t.active = true
    LIMIT 1
),
-- Determine message role - simulation agent handles speak (assistant role)
message_role AS (
    SELECT 'assistant'::message_role as role
),
-- Get or create tool_call
existing_tool_call AS (
    SELECT tc.id as tool_call_id, tc.external_call_id
    FROM params p
    JOIN calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.external_call_id = p.call_id)
    )
    LIMIT 1
),
create_tool_call AS (
    INSERT INTO calls (external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        COALESCE(p.call_id, 'simulation_' || p.tool_call_id),
        gt.tool_id,
        (SELECT template_id FROM tool_templates WHERE tool_id = gt.tool_id LIMIT 1),
        COALESCE(p.arguments_raw, ''),
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN get_tool_id gt
    WHERE NOT EXISTS (SELECT 1 FROM existing_tool_call)
    RETURNING id as tool_call_id, external_call_id
),
selected_tool_call AS (
    SELECT tool_call_id::text, external_call_id FROM existing_tool_call
    UNION ALL
    SELECT tool_call_id::text, external_call_id FROM create_tool_call
),
-- Link call to message via message_calls (run_id removed from calls table)
link_call_to_message AS (
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    SELECT 
        m.id as message_id,
        uuid(stc.tool_call_id) as call_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_tool_call stc
    JOIN message_runs mr ON mr.run_id = p.run_id
    JOIN message_artifact m ON m.id = mr.message_id
    WHERE m.role = 'assistant'
    ORDER BY m.created_at
    LIMIT 1
    ON CONFLICT (message_id, call_id) DO NOTHING
),
-- Update arguments_raw on calls if provided
update_call_arguments AS (
    UPDATE calls
    SET arguments_raw = COALESCE((SELECT p.arguments_raw FROM params p LIMIT 1), ''), updated_at = NOW()
    WHERE id IN (SELECT uuid(tool_call_id) FROM selected_tool_call)
      AND (SELECT p.arguments_raw FROM params p LIMIT 1) IS NOT NULL 
      AND (SELECT p.arguments_raw FROM params p LIMIT 1) != ''
    RETURNING calls.id
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
    JOIN calls tc ON tc.id = uuid(stc.tool_call_id)
    JOIN message_calls mc ON mc.call_id = tc.id
    JOIN message_artifact m ON m.id = mc.message_id
    WHERE p.message_id IS NULL
    LIMIT 1
),
create_message AS (
    INSERT INTO message_artifact (role, completed, audio, created_at, updated_at)
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
-- Get existing content_id if message_contents exists, otherwise create new content
get_existing_content AS (
    SELECT cnt.id as content_id
    FROM params p
    CROSS JOIN selected_message sm
    JOIN message_contents mc ON mc.message_id = uuid(sm.message_id) AND mc.idx = 0
    JOIN contents cnt ON cnt.id = mc.content_id
    LIMIT 1
),
create_content AS (
    INSERT INTO contents (content, created_at, updated_at)
    SELECT 
        p.accumulated_content,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    CROSS JOIN selected_tool_call stc
    WHERE NOT EXISTS (SELECT 1 FROM get_existing_content)
    RETURNING id as content_id
),
selected_content_id AS (
    SELECT content_id FROM get_existing_content
    UNION ALL
    SELECT content_id FROM create_content
),
-- Update existing content or create new junction
update_existing_content AS (
    UPDATE contents cnt
    SET content = p.accumulated_content,
        updated_at = NOW()
    FROM params p
    CROSS JOIN selected_content_id sci
    WHERE cnt.id = sci.content_id
      AND EXISTS (SELECT 1 FROM get_existing_content)
),
upsert_message_content AS (
    INSERT INTO message_contents (message_id, content_id, idx, created_at, updated_at)
    SELECT 
        uuid(sm.message_id),
        sci.content_id,
        0,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    CROSS JOIN selected_content_id sci
    ON CONFLICT (message_id, content_id) DO UPDATE SET
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
-- Link message to persona if provided
link_message_to_persona AS (
    INSERT INTO message_personas (message_id, persona_id, created_at, updated_at)
    SELECT 
        uuid(sm.message_id),
        p.persona_id,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN selected_message sm
    WHERE p.persona_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM message_personas mp 
          WHERE mp.message_id = uuid(sm.message_id)
          AND mp.persona_id = p.persona_id
      )
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

