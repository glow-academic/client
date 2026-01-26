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
    SELECT EXISTS (SELECT 1 FROM general_chats_entry WHERE id = chat_id) as is_general;
$$;
