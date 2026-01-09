-- Finalize document schema tool call - marks tool_call as completed and extracts schema_json
-- Handles generate_schema tool (tool_type='schema')
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_document_tool_schema_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_tool_schema_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_document_tool_schema_complete_v4(
    run_id uuid,
    tool_call_id text,
    call_id text,
    document_id uuid DEFAULT NULL
)
RETURNS TABLE (
    tool_call_id text,
    template_schema_json text,
    completed boolean
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT run_id, tool_call_id, call_id, document_id
),
-- Get tool_call and final arguments
get_tool_call AS (
    SELECT tc.id as tool_call_id, tc.arguments_raw, 
           CASE WHEN tc.arguments_raw ~ '^[\s]*\{' THEN tc.arguments_raw::jsonb ELSE NULL END as arguments_json
    FROM params p
    JOIN calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.external_call_id = p.call_id)
    )
    LIMIT 1
),
-- Parse schema_json from arguments_json
extract_schema_json AS (
    SELECT 
        gtc.tool_call_id,
        COALESCE(
            (gtc.arguments_json->>'schema_json')::text,
            (gtc.arguments_raw::jsonb->>'schema_json')::text,
            '{}'
        ) as template_schema_json
    FROM get_tool_call gtc
),
-- Finalize tool_call (mark as completed)
finalize_tool_call AS (
    UPDATE calls
    SET completed = true,
        updated_at = NOW()
    FROM get_tool_call gtc
    WHERE calls.id = gtc.tool_call_id
    RETURNING id as tool_call_id, completed
)
SELECT 
    (SELECT tool_call_id::text FROM finalize_tool_call LIMIT 1) as tool_call_id,
    (SELECT template_schema_json FROM extract_schema_json LIMIT 1) as template_schema_json,
    (SELECT completed FROM finalize_tool_call LIMIT 1) as completed
$$;

