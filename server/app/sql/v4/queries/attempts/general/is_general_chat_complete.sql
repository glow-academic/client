-- Check if chat_id is general
DROP FUNCTION IF EXISTS socket_is_general_chat_v4(uuid);

CREATE OR REPLACE FUNCTION socket_is_general_chat_v4(
    chat_id uuid
)
RETURNS TABLE (
    is_general boolean
)
LANGUAGE sql
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM simulation_chats_entry c
        JOIN simulation_attempts_entry a ON a.id = c.attempt_id
        WHERE c.id = chat_id
          AND a.practice IS FALSE
    ) as is_general;
$$;
