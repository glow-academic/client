-- Create a test chat for socket tests_entry
-- Returns chat_id
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_chat_v4(uuid, text);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_chat_v4(
    scenario_id uuid,
    trace_id text DEFAULT 'test-trace-id'
)
RETURNS TABLE (
    chat_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: chat table doesn't have trace_id column
    -- trace_id is stored in groups_entry table, not chat
    WITH new_chat AS (
        INSERT INTO chats_entry(title, completed)
        VALUES ('Test Chat', false)
        RETURNING id
    ),
    junction_insert AS (
        INSERT INTO scenario_chats_junction(scenario_id, chat_id)
        SELECT test_create_test_chat_v4.scenario_id, new_chat.id
        FROM new_chat
    )
    SELECT id AS chat_id FROM new_chat;
$$;