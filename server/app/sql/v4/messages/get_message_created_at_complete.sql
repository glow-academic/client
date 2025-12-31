-- Get message created_at timestamp
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern

BEGIN;

-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_get_message_created_at_v4(uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_get_message_created_at_v4(
    message_id uuid
)
RETURNS TABLE (
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
SELECT created_at FROM messages WHERE id = message_id
$$;

COMMIT;

