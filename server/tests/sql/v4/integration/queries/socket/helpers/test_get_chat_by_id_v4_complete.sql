-- Get chat by ID for test verification
-- Returns chat details
-- Updated for migration 331: Queries both general_chats_entry and practice_chats_entry
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
    WITH all_chats AS (
        SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active, false as is_practice
        FROM general_chats_entry
        UNION ALL
        SELECT id, attempt_id, created_at, updated_at, title, completed, generated, mcp, active, true as is_practice
        FROM practice_chats_entry
    )
    SELECT id, completed, created_at
    FROM all_chats
    WHERE id = test_get_chat_by_id_v4.chat_id;
$$;
