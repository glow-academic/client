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
    SELECT t.id as tool_id, COALESCE(r.name, '') as tool_type, t.name as tool_name
    FROM params p
    JOIN tools t ON t.name = p.tool_name
    JOIN agent_tools at ON at.tool_id = t.id
    JOIN runs r_run ON r_run.id = p.run_id
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN resources r ON r.id = rt.resource_id
    WHERE at.agent_id = r_run.agent_id
      AND at.active = true
      AND t.active = true
    LIMIT 1
),
-- Get or create tool_call (by call_id or tool_call_id)
existing_tool_call AS (
    SELECT tc.id as tool_call_id, tc.call_id
    FROM params p
    JOIN calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.call_id = p.call_id)
    )
    LIMIT 1
),
create_tool_call AS (
    INSERT INTO calls (call_id, tool_id, completed, created_at, updated_at)
    SELECT 
        COALESCE(p.call_id, 'text_' || p.tool_call_id),
        gt.tool_id,
        false,
        NOW(),
        NOW()
    FROM params p
    CROSS JOIN get_tool_info gt
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
-- Accumulate arguments_raw (SQL accumulates!)
accumulate_arguments AS (
    SELECT 
        uuid(stc.tool_call_id) as tool_call_id,
        CASE 
            WHEN p.progress_type = 'tool_call_start' THEN COALESCE(p.arguments_delta, '')
            WHEN p.progress_type = 'tool_call_progress' THEN 
                COALESCE(
                    (SELECT arguments_raw FROM tool_call_arguments tca 
                     WHERE tca.tool_call_id = uuid(stc.tool_call_id) 
                     ORDER BY created_at DESC LIMIT 1),
                    ''
                ) || COALESCE(p.arguments_delta, '')
            ELSE COALESCE(p.arguments_delta, '')
        END as accumulated_raw
    FROM params p
    CROSS JOIN selected_tool_call stc
),
-- Upsert tool_call_arguments (SQL accumulates)
upsert_tool_call_arguments AS (
    INSERT INTO tool_call_arguments (tool_call_id, arguments_json, arguments_raw, created_at)
    SELECT 
        aa.tool_call_id,
        CASE 
            WHEN aa.accumulated_raw ~ '^[\s]*\{' THEN aa.accumulated_raw::jsonb
            ELSE NULL
        END,
        aa.accumulated_raw,
        NOW()
    FROM accumulate_arguments aa
    WHERE aa.accumulated_raw IS NOT NULL AND aa.accumulated_raw != ''
    ON CONFLICT (tool_call_id) DO UPDATE SET
        arguments_raw = EXCLUDED.arguments_raw,
        arguments_json = EXCLUDED.arguments_json
)
SELECT 
    (SELECT tool_id FROM get_tool_info LIMIT 1) as tool_id,
    (SELECT tool_type FROM get_tool_info LIMIT 1) as tool_type,
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1) as tool_call_id,
    (SELECT call_id FROM selected_tool_call LIMIT 1) as persisted_call_id,
    (SELECT tool_name FROM get_tool_info LIMIT 1) as tool_name,
    (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) as arguments_raw
$$;

