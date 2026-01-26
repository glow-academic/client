DROP FUNCTION IF EXISTS api_update_chat_created_at_v4(timestamptz, uuid);
CREATE OR REPLACE FUNCTION api_update_chat_created_at_v4(
    created_at timestamptz,
    chat_id uuid
)
RETURNS TABLE (
    chat_id text
)
LANGUAGE sql
AS $$
WITH
-- Check if chat exists in general_chats_entry
general_chat_exists AS (
    SELECT id FROM general_chats_entry
    WHERE general_chats_entry.id = api_update_chat_created_at_v4.chat_id
),
-- Check if chat exists in practice_chats_entry
practice_chat_exists AS (
    SELECT id FROM practice_chats_entry
    WHERE practice_chats_entry.id = api_update_chat_created_at_v4.chat_id
),
-- Update general_chats_entry if chat exists there
update_general_chat AS (
    UPDATE general_chats_entry
    SET created_at = api_update_chat_created_at_v4.created_at,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM general_chat_exists)
    RETURNING id::text as chat_id
),
-- Update practice_chats_entry if chat exists there
update_practice_chat AS (
    UPDATE practice_chats_entry
    SET created_at = api_update_chat_created_at_v4.created_at,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM practice_chat_exists)
    RETURNING id::text as chat_id
)
SELECT chat_id FROM update_general_chat
UNION ALL
SELECT chat_id FROM update_practice_chat
$$;
