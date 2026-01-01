-- Get chat by ID for test verification
-- Returns chat details

BEGIN;

-- Drop function if exists
DROP FUNCTION IF EXISTS test_get_chat_by_id_v4(uuid);

-- Create function
CREATE OR REPLACE FUNCTION test_get_chat_by_id_v4(
    chat_id uuid
)
RETURNS TABLE (
    id uuid,
    completed boolean,
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
    SELECT id, completed, created_at 
    FROM chats 
    WHERE id = test_get_chat_by_id_v4.chat_id;
$$;

COMMIT;

