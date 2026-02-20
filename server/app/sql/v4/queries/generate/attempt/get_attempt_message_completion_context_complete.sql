-- Resolve assistant message + chat context for an attempt run

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_attempt_message_completion_context_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_attempt_message_completion_context_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_get_attempt_message_completion_context_v4(
    p_run_id uuid
)
RETURNS TABLE (
    message_id uuid,
    chat_id uuid,
    attempt_id uuid,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
SELECT
    m.id AS message_id,
    sm.chat_id,
    ac.attempt_id,
    m.created_at
FROM messages_entry m
JOIN attempt_message_entry sm ON sm.id = m.id
JOIN chat_resolved_entry c ON c.id = sm.chat_id
JOIN attempt_chat_entry ac ON ac.chat_resolved_id = c.id
WHERE m.run_id = p_run_id
  AND m.role = 'assistant'::message_type
ORDER BY m.created_at DESC
LIMIT 1
$$;
