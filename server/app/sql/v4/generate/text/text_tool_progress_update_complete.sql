-- Update text generation tool call progress - creates/updates tool_call and accumulates arguments
-- Generic version that works with any agent and tool
-- Returns tool_type for routing to tool-specific handlers
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_text_tool_progress_update_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_text_tool_progress_update_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_text_tool_progress_update_v4(
    run_id uuid,
    tool_call_id text,
    progress_type text,
    call_id text DEFAULT NULL,
    tool_name text DEFAULT NULL,
    arguments_delta text DEFAULT '',
    resource_id uuid DEFAULT NULL
)
RETURNS TABLE (
    tool_id uuid,
    tool_type text,  -- Changed from enum to text, derived from resources
    tool_call_id text,
    persisted_call_id text,
    tool_name text,
    arguments_raw text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT run_id, tool_call_id, call_id, tool_name, arguments_delta, progress_type, resource_id
),
-- Get tool_id AND tool_type from tool_name + agent_tools junction table
-- Works with any agent (not hardcoded to document)
get_tool_info AS (
    SELECT t.id as tool_id, COALESCE(rt.resource::text, '') as tool_type, t.name as tool_name
    FROM params p
    JOIN tools t ON t.name = p.tool_name
    JOIN agent_tools at ON at.tool_id = t.id
    JOIN runs r_run ON r_run.id = p.run_id
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    WHERE at.agent_id = r_run.agent_id
      AND at.active = true
      AND t.active = true
    LIMIT 1
),
-- Get or create tool_call (by call_id or tool_call_id)
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
    INSERT INTO calls (external_call_id, tool_id, run_id, template_id, arguments_raw, completed, created_at, updated_at)
    SELECT 
        COALESCE(p.call_id, 'text_' || p.tool_call_id),
        gt.tool_id,
        p.run_id,
        (SELECT template_id FROM tool_templates WHERE tool_id = gt.tool_id LIMIT 1),
        '',
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN get_tool_info gt
    WHERE NOT EXISTS (SELECT 1 FROM existing_tool_call)
    RETURNING id as tool_call_id, external_call_id
),
selected_tool_call AS (
    SELECT tool_call_id::text, external_call_id FROM existing_tool_call
    UNION ALL
    SELECT tool_call_id::text, external_call_id FROM create_tool_call
),
-- Update run_id on calls if needed (run_id is now a direct column)
update_call_run_id AS (
    UPDATE calls
    SET run_id = (SELECT p.run_id FROM params p LIMIT 1), updated_at = NOW()
    WHERE id IN (SELECT uuid(tool_call_id) FROM selected_tool_call)
      AND run_id IS DISTINCT FROM (SELECT p.run_id FROM params p LIMIT 1)
    RETURNING calls.id
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
    (SELECT tool_id FROM get_tool_info LIMIT 1) as tool_id,
    (SELECT tool_type FROM get_tool_info LIMIT 1) as tool_type,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1) as tool_call_id,
    (SELECT external_call_id FROM selected_tool_call LIMIT 1) as persisted_call_id,
    (SELECT tool_name FROM get_tool_info LIMIT 1) as tool_name,
    (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) as arguments_raw
$$;

