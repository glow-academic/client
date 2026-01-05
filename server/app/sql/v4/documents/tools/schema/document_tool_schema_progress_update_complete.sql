-- Update document schema tool call progress - creates/updates tool_call and accumulates arguments
-- Handles create_schema tool (tool_type='schema', tool_name='create_schema')
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_document_tool_schema_progress_update_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_tool_schema_progress_update_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_document_tool_schema_progress_update_v4(
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
-- Get tool_id for schema tool (tool_type='schema', agent_role='document')
get_tool_id AS (
    SELECT t.id as tool_id
    FROM tools t
    WHERE t.tool_type = 'schema'::tool_type
      AND t.agent_role = 'document'::agent_role
      AND t.active = true
    LIMIT 1
),
-- Get or create tool_call
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
        COALESCE(p.call_id, 'document_schema_' || p.tool_call_id),
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
    (SELECT tool_call_id FROM selected_tool_call LIMIT 1) as tool_call_id,
    (SELECT call_id FROM selected_tool_call LIMIT 1) as persisted_call_id,
    (SELECT accumulated_raw FROM accumulate_arguments LIMIT 1) as arguments_raw
$$;

