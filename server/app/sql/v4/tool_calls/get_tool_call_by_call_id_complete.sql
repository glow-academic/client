-- Get tool_call by call_id
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_tool_call_by_call_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_tool_call_by_call_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_tool_call_by_call_id_v4(
    call_id text
)
RETURNS TABLE (
    id uuid,
    call_id text,
    tool_id uuid,
    completed boolean
)
LANGUAGE sql
STABLE
AS $$
SELECT id, call_id, tool_id, completed
FROM tool_calls
WHERE call_id = api_get_tool_call_by_call_id_v4.call_id
LIMIT 1
$$;

COMMIT;

