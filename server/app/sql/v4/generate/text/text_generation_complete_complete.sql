-- Text generation complete event handler
-- Generic version that finalizes text generation
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
        WHERE proname = 'socket_text_generation_complete_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_text_generation_complete_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_text_generation_complete_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
-- Generic completion handler - returns success and tool results
CREATE OR REPLACE FUNCTION socket_text_generation_complete_v4(
    profile_id uuid,
    run_id uuid,
    resource_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    department_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    tool_results jsonb,
    trace_id text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    tool_results_val jsonb;
    trace_id_val text;
BEGIN
    -- Get trace_id from groups table if group_id provided
    IF group_id IS NOT NULL THEN
        SELECT trace_id INTO trace_id_val FROM groups WHERE id = group_id LIMIT 1;
    END IF;

    -- Get tool results
    SELECT tool_results INTO tool_results_val
    FROM socket_get_text_tool_call_results_v4(run_id);

    -- Return completion data
    RETURN QUERY
    SELECT 
        true as success,
        'Text generation completed successfully' as message,
        COALESCE(tool_results_val, '{}'::jsonb) as tool_results,
        trace_id_val as trace_id;
END;
$$;

