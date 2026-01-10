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
FROM calls tc
JOIN message_calls mc ON mc.call_id = tc.id
JOIN message m ON m.id = mc.message_id
JOIN message_runs mr ON mr.message_id = m.id
WHERE tc.id = api_get_message_id_from_tool_call_v4.tool_call_id
  AND mr.run_id = api_get_message_id_from_tool_call_v4.run_id
  AND m.role = 'assistant'::message_role
ORDER BY m.created_at DESC
LIMIT 1
$$;