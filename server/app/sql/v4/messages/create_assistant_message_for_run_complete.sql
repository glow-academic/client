-- Create or reuse assistant message for a run
-- Uses safe drop/recreate pattern: drop function first, then recreate
DROP FUNCTION IF EXISTS socket_create_assistant_message_for_run_v4(uuid);

CREATE OR REPLACE FUNCTION socket_create_assistant_message_for_run_v4(
    run_id uuid
)
RETURNS TABLE (
    assistant_message_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT run_id
),
existing_assistant_message AS (
    SELECT m.id as assistant_message_id
    FROM params p
    JOIN message_runs mr ON mr.run_id = p.run_id
    JOIN messages m ON m.id = mr.message_id
    WHERE m.role = 'assistant'::message_role
    ORDER BY m.created_at DESC
    LIMIT 1
),
new_assistant_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'assistant'::message_role, false, false, NOW(), NOW()
    FROM params p
    WHERE NOT EXISTS (SELECT 1 FROM existing_assistant_message)
    RETURNING id as assistant_message_id, created_at, updated_at
),
link_assistant_message AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT nam.assistant_message_id, p.run_id, NOW(), NOW()
    FROM new_assistant_message nam
    CROSS JOIN params p
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
)
SELECT COALESCE(
    (SELECT assistant_message_id FROM existing_assistant_message),
    (SELECT assistant_message_id FROM new_assistant_message)
) as assistant_message_id
$$;
