-- Create a test chat for socket tests_entry
-- Returns chat_id
-- Updated for migration 331: Creates general_chats_entry or practice_chats_entry
-- Drop function if exists
DROP FUNCTION IF EXISTS test_create_test_chat_v4(uuid, text);
DROP FUNCTION IF EXISTS test_create_test_chat_v4(uuid, uuid, text, boolean);

-- Create function
CREATE OR REPLACE FUNCTION test_create_test_chat_v4(
    scenario_id uuid,
    attempt_id uuid,
    trace_id text DEFAULT 'test-trace-id',
    is_practice boolean DEFAULT false
)
RETURNS TABLE (
    chat_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
    -- NOTE: chat table doesn't have trace_id column
    -- trace_id is stored in groups_entry table, not chat
    WITH scenario_resource AS (
        -- Get scenarios_resource.id for the connection table
        SELECT ssj.scenarios_id
        FROM scenario_scenarios_junction ssj
        WHERE ssj.scenario_id = test_create_test_chat_v4.scenario_id
        LIMIT 1
    ),
    new_general_chat AS (
        -- Create general chat (non-practice)
        INSERT INTO general_chats_entry(title, completed, attempt_id)
        SELECT 'Test Chat', false, test_create_test_chat_v4.attempt_id
        WHERE NOT test_create_test_chat_v4.is_practice
        RETURNING id
    ),
    new_practice_chat AS (
        -- Create practice chat
        INSERT INTO practice_chats_entry(title, completed, attempt_id)
        SELECT 'Test Chat', false, test_create_test_chat_v4.attempt_id
        WHERE test_create_test_chat_v4.is_practice
        RETURNING id
    ),
    general_connection AS (
        INSERT INTO general_chats_scenarios_connection(chat_id, scenarios_id)
        SELECT ngc.id, sr.scenarios_id
        FROM new_general_chat ngc
        CROSS JOIN scenario_resource sr
        WHERE sr.scenarios_id IS NOT NULL
    ),
    practice_connection AS (
        INSERT INTO practice_chats_scenarios_connection(chat_id, scenarios_id)
        SELECT npc.id, sr.scenarios_id
        FROM new_practice_chat npc
        CROSS JOIN scenario_resource sr
        WHERE sr.scenarios_id IS NOT NULL
    )
    SELECT id AS chat_id FROM new_general_chat
    UNION ALL
    SELECT id AS chat_id FROM new_practice_chat;
$$;
