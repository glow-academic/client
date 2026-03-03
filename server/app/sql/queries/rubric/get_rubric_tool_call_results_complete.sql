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
-- NOTE: calls_completion_entry was dropped in migration 29.
-- New calls use upload_id → uploads_entry.file_path for JSON content.
-- This function reads from uploads_entry when upload_id is available,
-- otherwise returns empty array (legacy calls without upload_id).
CREATE OR REPLACE FUNCTION socket_get_rubric_tool_call_results_v4(
    run_id uuid
)
RETURNS TABLE (
    descriptions jsonb
)
LANGUAGE sql
STABLE
AS $$
SELECT '[]'::jsonb as descriptions
$$;

