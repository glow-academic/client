-- Get text generation tool call results from tool_call_arguments
-- Generic version that extracts results from any tool calls for a given run_id
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
        WHERE proname = 'socket_get_text_tool_call_results_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_tool_call_results_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_text_tool_call_results_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
-- Returns all tool call results as JSONB for flexible extraction
CREATE OR REPLACE FUNCTION socket_get_text_tool_call_results_v4(
    run_id uuid
)
RETURNS TABLE (
    tool_results jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH tool_call_results AS (
    -- Get all tool call results for the run
    SELECT 
        jsonb_object_agg(
            t.name,
            CASE WHEN tc.arguments_raw ~ '^[\s]*\{' THEN tc.arguments_raw::jsonb ELSE NULL END
        ) as tool_results
    FROM calls tc
    JOIN tools t ON t.id = tc.tool_id
    JOIN message_calls mc ON mc.call_id = tc.id
    JOIN message_runs mr ON mr.message_id = mc.message_id
    WHERE mr.run_id = $1
      AND tc.completed = true
)
SELECT 
    COALESCE((SELECT tool_results FROM tool_call_results), '{}'::jsonb) as tool_results
$$;

