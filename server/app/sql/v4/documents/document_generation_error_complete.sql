-- Document generation error event handler
-- Returns error payload structure for client with trace_id lookup
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
        WHERE proname = 'socket_document_generation_error_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_document_generation_error_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'i_document_generation_error_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function
CREATE OR REPLACE FUNCTION socket_document_generation_error_v4(
    profile_id uuid,
    error_message text,
    document_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL
)
RETURNS TABLE (
    success boolean,
    message text,
    trace_id text
)
LANGUAGE sql
VOLATILE
AS $$
-- Returns error payload structure for client
-- trace_id comes from groups table if group_id provided, otherwise NULL
SELECT 
    false as success,
    error_message as message,
    (SELECT trace_id FROM groups WHERE id = group_id LIMIT 1) as trace_id
$$;

