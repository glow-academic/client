-- Get document tool call results (template_html and schema_json) from tool_call_arguments
-- Extracts results from generate_html and generate_schema tool calls for a given run_id
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'socket_get_document_tool_call_results_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_document_tool_call_results_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_document_tool_call_results_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_get_document_tool_call_results_v4(
    run_id uuid
)
RETURNS TABLE (
    template_html text,
    template_schema_json text
)
LANGUAGE sql
STABLE
AS $$
WITH html_result AS (
    -- Get template_html from generate_html tool_call
    SELECT tca.arguments_json->>'template_html' as template_html
    FROM tool_calls tc
    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
    JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
    JOIN tools t ON t.id = tc.tool_id
    WHERE tcr.run_id = $1
      AND t.name = 'create_html'
      AND tc.completed = true
    ORDER BY tc.created_at DESC
    LIMIT 1
),
schema_result AS (
    -- Get schema_json from generate_schema tool_call
    SELECT tca.arguments_json->>'schema_json' as schema_json
    FROM tool_calls tc
    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
    JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
    JOIN tools t ON t.id = tc.tool_id
    WHERE tcr.run_id = $1
      AND t.name = 'create_schema'
      AND tc.completed = true
    ORDER BY tc.created_at DESC
    LIMIT 1
)
SELECT 
    COALESCE((SELECT template_html FROM html_result), '') as template_html,
    COALESCE((SELECT schema_json FROM schema_result), '{}') as template_schema_json
$$;

