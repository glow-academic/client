-- UPDATE document_artifact title tool call progress - creates/updates tool_call and accumulates arguments
-- Handles create_title tool (tool_type='title')
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_document_tool_title_progress_update_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_tool_title_progress_update_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_document_tool_title_progress_update_v4(
    run_id uuid,
    tool_call_id text,
    call_id text,
    arguments_delta text,
    progress_type text,
    document_id uuid DEFAULT NULL
)
RETURNS TABLE (
    tool_call_id text,
    persisted_call_id text,
    arguments_raw text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT run_id, tool_call_id, call_id, arguments_delta, progress_type, document_id
),
-- Get tool_id for title tool (resource='problem_statement' or 'template', artifact='document')
-- Check agent_tools junction table for document agent via runs
get_tool_id AS (
    SELECT t.id as tool_id
    FROM params p
    JOIN runs r ON r.id = p.run_id
    JOIN agent_tools at ON at.agent_id = r.agent_id
    JOIN tool_artifact t ON t.id = at.tool_id
    INNER JOIN resource_tools rt ON rt.tool_id = t.id
    WHERE rt.resource IN ('problem_statements'::resources, 'templates'::resources)
      AND at.active = true
      AND t.active = true
    LIMIT 1
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
        COALESCE(p.call_id, 'document_title_' || p.tool_call_id),
        gt.tool_id,
        (SELECT template_id FROM tool_templates WHERE tool_id = gt.tool_id LIMIT 1),
        '',
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
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role = 'assistant'
    ORDER BY m.created_at
    LIMIT 1
    ON CONFLICT (message_id, call_id) DO NOTHING
),
-- Accumulate arguments_raw (SQL accumulates!)
accumulate_arguments AS (
    SELECT 
        uuid(stc.tool_call_id) as tool_call_id,
        CASE 
            WHEN p.progress_type = 'tool_call_start' THEN COALESCE(p.arguments_delta, '')
            WHEN p.progress_type = 'tool_call_progress' THEN 
                COALESCE(
                    (SELECT arguments_raw FROM calls c 
                     WHERE c.id = uuid(stc.tool_call_id)),
                    ''
                ) || COALESCE(p.arguments_delta, '')
            ELSE COALESCE(p.arguments_delta, '')
        END as accumulated_raw
    FROM params p
    CROSS JOIN selected_tool_call stc
),
-- Update arguments_raw on calls (arguments_raw is now a direct column)
update_call_arguments AS (
    UPDATE calls
    SET arguments_raw = (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1), updated_at = NOW()
    WHERE id IN (SELECT tool_call_id FROM accumulate_arguments)
      AND (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) IS NOT NULL 
      AND (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) != ''
    RETURNING calls.id
)
SELECT 
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1) as tool_call_id,
    (SELECT external_call_id FROM selected_tool_call LIMIT 1) as persisted_call_id,
    (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) as arguments_raw
$$;

