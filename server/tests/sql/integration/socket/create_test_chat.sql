-- Create a test simulation chat
-- Parameters: $1 = scenario_id (UUID), $2 = attempt_id (UUID, optional), $3 = completed (bool, optional), $4 = title (text, optional)
-- Returns: chat_id (UUID)
INSERT INTO simulation_chats(title, scenario_id, completed, trace_id)
VALUES (
    COALESCE($4, 'Test Chat'),
    $1::uuid,
    COALESCE($3, false),
    'test-trace-id'
)
RETURNING id;

