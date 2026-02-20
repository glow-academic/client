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
WITH update_chat AS (
    UPDATE chat_resolved_entry
    SET created_at = api_update_chat_created_at_v4.created_at,
        updated_at = NOW()
    WHERE id = api_update_chat_created_at_v4.chat_id
    RETURNING id::text as chat_id
)
SELECT chat_id FROM update_chat
$$;
