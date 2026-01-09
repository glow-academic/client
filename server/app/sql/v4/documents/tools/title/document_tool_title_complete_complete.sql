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
    SELECT tc.id as tool_call_id, tc.arguments_raw, 
           CASE WHEN tc.arguments_raw ~ '^[\s]*\{' THEN tc.arguments_raw::jsonb ELSE NULL END as arguments_json
    FROM params p
    JOIN calls tc ON (
        (p.tool_call_id IS NOT NULL AND tc.id::text = p.tool_call_id)
        OR (p.call_id IS NOT NULL AND tc.external_call_id = p.call_id)
    )
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
-- Insert/update name in names table
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT et.title, NOW(), NOW()
    FROM extract_title et
    WHERE et.title IS NOT NULL AND et.title != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Update document (without name column)
update_document AS (
    UPDATE documents
    SET updated_at = NOW()
    FROM extract_title et
    CROSS JOIN params p
    WHERE documents.id = p.document_id
      AND et.title IS NOT NULL
      AND et.title != ''
    RETURNING documents.id as document_id
),
-- Remove old name links
remove_old_name AS (
    DELETE FROM document_names
    WHERE document_id IN (SELECT document_id FROM update_document)
      AND name_id NOT IN (SELECT name_id FROM name_resource)
),
-- Link document to new name
link_document_name AS (
    INSERT INTO document_names (document_id, name_id, created_at, updated_at)
    SELECT 
        ud.document_id,
        nr.name_id,
        NOW(),
        NOW()
    FROM update_document ud
    CROSS JOIN name_resource nr
    ON CONFLICT (document_id, name_id) DO UPDATE SET updated_at = NOW()
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
    (SELECT document_id FROM update_document LIMIT 1) as document_id,
    (SELECT n.name FROM names n JOIN name_resource nr ON n.id = nr.name_id LIMIT 1) as title,
    (SELECT completed FROM finalize_tool_call LIMIT 1) as completed
$$;

