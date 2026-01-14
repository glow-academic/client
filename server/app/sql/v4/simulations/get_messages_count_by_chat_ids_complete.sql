-- Get message counts for multiple chats (batch query)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_messages_count_by_chat_ids_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_messages_count_by_chat_ids_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_messages_count_by_chat_ids_v4(
    chat_ids uuid[]
)
RETURNS TABLE (
    chat_id uuid,
    message_count bigint
)
LANGUAGE sql
STABLE
AS $$
SELECT c.id AS chat_id, COUNT(*) as message_count
FROM chats c
JOIN chat_groups cg ON cg.chat_id = c.id
JOIN groups g ON g.id = cg.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN runs r ON r.id = gr.run_id
JOIN message_runs mr ON mr.run_id = r.id
JOIN messages m ON m.id = mr.message_id
WHERE c.id = ANY(chat_ids)
GROUP BY c.id
$$;