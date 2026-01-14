-- Get rubric tool call results (descriptions) from tool_call_arguments
-- Extracts descriptions array from standard_description tool call for a given run_id
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
        WHERE proname = 'socket_get_rubric_tool_call_results_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_rubric_tool_call_results_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubric_tool_call_results_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_get_rubric_tool_call_results_v4(
    run_id uuid
)
RETURNS TABLE (
    descriptions jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH descriptions_result AS (
    -- Get descriptions array from standard_description tool_call
    SELECT CASE WHEN tc.arguments_raw ~ '^[\s]*\{' THEN tc.arguments_raw::jsonb->'descriptions' ELSE NULL END as descriptions
    FROM calls tc
    JOIN tool_artifact t ON t.id = tc.tool_id
    JOIN message_calls mc ON mc.call_id = tc.id
    JOIN message_runs mr ON mr.message_id = mc.message_id
    WHERE mr.run_id = $1
      AND (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) = 'standard_description'
      AND tc.completed = true
    ORDER BY tc.created_at DESC
    LIMIT 1
)
SELECT 
    COALESCE((SELECT descriptions FROM descriptions_result), '[]'::jsonb) as descriptions
$$;

