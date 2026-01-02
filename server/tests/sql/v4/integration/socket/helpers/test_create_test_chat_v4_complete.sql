-- Create a test chat for socket tests
-- Returns chat_id

BEGIN;

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
    -- NOTE: chats table doesn't have trace_id column
    -- trace_id is stored in groups table, not chats
    INSERT INTO chats(title, scenario_id, completed) 
    VALUES ('Test Chat', test_create_test_chat_v4.scenario_id, false) 
    RETURNING id as chat_id;
$$;

COMMIT;

