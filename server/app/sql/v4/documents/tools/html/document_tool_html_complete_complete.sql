-- Finalize document HTML tool call - marks tool_call as completed and extracts template_html
-- Handles generate_html tool (tool_type='html')
-- Uses safe drop/recreate pattern

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_document_tool_html_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_tool_html_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_document_tool_html_complete_v4(
    run_id uuid,
    tool_call_id text,
    call_id text,
    document_id uuid DEFAULT NULL
)
RETURNS TABLE (
    tool_call_id text,
    template_html text,
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
-- Parse template_html from arguments_json
extract_template_html AS (
    SELECT 
        gtc.tool_call_id,
        COALESCE(
            (gtc.arguments_json->>'template_html')::text,
            (gtc.arguments_raw::jsonb->>'template_html')::text,
            ''
        ) as template_html
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
    (SELECT template_html FROM extract_template_html LIMIT 1) as template_html,
    (SELECT completed FROM finalize_tool_call LIMIT 1) as completed
$$;

