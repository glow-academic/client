-- Create a test chat for socket view_tests_entry
-- Returns chat_id
-- Unified view_simulation_chats_entry (practice flag lives on attempt)
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
    -- trace_id is stored in view_groups_entry table, not chat
    WITH scenario_resource AS (
        -- Get scenarios_resource.id for the connection table
        SELECT ssj.scenarios_id
        FROM scenario_scenarios_junction ssj
        WHERE ssj.scenario_id = test_create_test_chat_v4.scenario_id
        LIMIT 1
    ),
    new_chat AS (
        -- Create simulation chat
        INSERT INTO simulation_chats_entry (title, completed, attempt_id)
        SELECT 'Test Chat', false, test_create_test_chat_v4.attempt_id
        RETURNING id
    ),
    simulation_connection AS (
        INSERT INTO simulation_chats_scenarios_connection(chat_id, scenarios_id)
        SELECT nc.id, sr.scenarios_id
        FROM new_chat nc
        CROSS JOIN scenario_resource sr
        WHERE sr.scenarios_id IS NOT NULL
    )
    SELECT id AS chat_id FROM new_chat;
$$;
