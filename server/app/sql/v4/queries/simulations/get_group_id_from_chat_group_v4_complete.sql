-- Get group_id from chat_id
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_get_group_id_from_chat_group_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_get_group_id_from_chat_group_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function
-- Uses unified chats from view_simulation_chats_entry and view_simulation_chats_entry
-- Path: chat.id -> view_messages_entry.chat_id -> view_messages_entry.run_id -> view_runs_entry.group_id
CREATE OR REPLACE FUNCTION socket_get_group_id_from_chat_group_v4(
    chat_id uuid
)
RETURNS TABLE (
    group_id uuid
)
LANGUAGE sql
STABLE
AS $$
    WITH all_chats AS (
    SELECT id FROM view_simulation_chats_entry
    )
    SELECT r.group_id
    FROM all_chats c
    JOIN view_messages_entry m ON m.chat_id = c.id
    JOIN view_runs_entry r ON r.id = m.run_id
    WHERE c.id = $1
    LIMIT 1
$$;
