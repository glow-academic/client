-- Get message_id from tool_call_id and run_id
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_message_id_from_tool_call_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_message_id_from_tool_call_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_message_id_from_tool_call_v4(
    tool_call_id uuid,
    run_id uuid
)
RETURNS TABLE (
    message_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT m.id as message_id
FROM tool_calls tc
JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
JOIN message_runs mr ON mr.run_id = tcr.run_id
JOIN messages m ON m.id = mr.message_id
WHERE tc.id = api_get_message_id_from_tool_call_v4.tool_call_id
  AND tcr.run_id = api_get_message_id_from_tool_call_v4.run_id
  AND m.role = 'assistant'::message_role
ORDER BY m.created_at DESC
LIMIT 1
$$;