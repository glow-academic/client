-- Finalize document title tool call - marks tool_call as completed and updates document name
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
        WHERE proname = 'socket_document_tool_title_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_tool_title_complete_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_document_tool_title_complete_v4(
    run_id uuid,
    tool_call_id text,
    call_id text,
    document_id uuid
)
RETURNS TABLE (
    tool_call_id text,
    document_id uuid,
    title text,
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
    SELECT tc.id as tool_call_id, tca.arguments_raw, tca.arguments_json
    FROM params p
    JOIN tool_calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.call_id = p.call_id)
    )
    LEFT JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
    LIMIT 1
),
-- Parse title from arguments_json
extract_title AS (
    SELECT 
        gtc.tool_call_id,
        COALESCE(
            (gtc.arguments_json->>'title')::text,
            (gtc.arguments_raw::jsonb->>'title')::text,
            ''
        ) as title
    FROM get_tool_call gtc
),
-- Update document name
update_document AS (
    UPDATE documents
    SET name = et.title,
        updated_at = NOW()
    FROM extract_title et
    CROSS JOIN params p
    WHERE documents.id = p.document_id
      AND et.title IS NOT NULL
      AND et.title != ''
    RETURNING documents.id as document_id, documents.name as title
),
-- Finalize tool_call (mark as completed)
finalize_tool_call AS (
    UPDATE tool_calls
    SET completed = true,
        updated_at = NOW()
    FROM get_tool_call gtc
    WHERE tool_calls.id = gtc.tool_call_id
    RETURNING id as tool_call_id, completed
)
SELECT 
    (SELECT tool_call_id::text FROM finalize_tool_call LIMIT 1) as tool_call_id,
    (SELECT document_id FROM update_document LIMIT 1) as document_id,
    (SELECT title FROM update_document LIMIT 1) as title,
    (SELECT completed FROM finalize_tool_call LIMIT 1) as completed
$$;

