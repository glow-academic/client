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
WITH chat_exists AS (
    -- Check if chat exists
    SELECT id
    FROM chat
    WHERE chat.id = api_update_chat_created_at_v4.chat_id
),
update_chat AS (
    -- Update the createdAt timestamp only if chat exists
    UPDATE chat
    SET created_at = api_update_chat_created_at_v4.created_at,
        updated_at = NOW()
    WHERE id IN (SELECT id FROM chat_exists)
    RETURNING id::text as chat_id
)
SELECT chat_id FROM update_chat
$$;