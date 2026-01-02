-- Validate that a message belongs to a chat
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
        WHERE proname = 'api_validate_message_belongs_to_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_validate_message_belongs_to_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_validate_message_belongs_to_chat_v4(
    chat_id uuid,
    message_id uuid
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT m.id
FROM messages m
JOIN message_runs mr ON mr.message_id = m.id
JOIN runs r ON r.id = mr.run_id
JOIN group_runs gr ON gr.run_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chat_groups cg ON cg.group_id = g.id
JOIN chats c ON c.id = cg.chat_id
WHERE c.id = chat_id
  AND m.id = message_id
LIMIT 1
$$;

COMMIT;

