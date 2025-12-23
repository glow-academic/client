-- Create a test chat with system/user/assistant messages
-- Parameters: $1 = scenario_id (UUID), $2 = run_id (UUID), $3 = attempt_id (UUID, optional)
-- Returns: chat_id (UUID), system_message_id (UUID), user_message_id (UUID), assistant_message_id (UUID)
WITH new_chat AS (
    INSERT INTO simulation_chats(title, scenario_id, completed, trace_id)
    VALUES ('Test Chat', $1::uuid, false, 'test-trace-id')
    RETURNING id as chat_id
),
system_msg AS (
    INSERT INTO messages(role, content, created_at)
    VALUES ('system', 'You are a helpful assistant.', NOW())
    RETURNING id as message_id
),
user_msg AS (
    INSERT INTO messages(role, content, created_at)
    VALUES ('user', 'Hello, how are you?', NOW())
    RETURNING id as message_id
),
assistant_msg AS (
    INSERT INTO messages(role, content, created_at)
    VALUES ('assistant', 'I am doing well, thank you!', NOW())
    RETURNING id as message_id
),
link_system AS (
    INSERT INTO message_runs(message_id, run_id)
    SELECT sm.message_id, $2::uuid
    FROM system_msg sm
),
link_user AS (
    INSERT INTO message_runs(message_id, run_id)
    SELECT um.message_id, $2::uuid
    FROM user_msg um
),
link_assistant AS (
    INSERT INTO message_runs(message_id, run_id)
    SELECT am.message_id, $2::uuid
    FROM assistant_msg am
),
link_chat AS (
    INSERT INTO attempt_chats(attempt_id, chat_id)
    SELECT $3::uuid, nc.chat_id
    FROM new_chat nc
    WHERE $3 IS NOT NULL
)
SELECT 
    nc.chat_id::text as chat_id,
    (SELECT message_id::text FROM system_msg) as system_message_id,
    (SELECT message_id::text FROM user_msg) as user_message_id,
    (SELECT message_id::text FROM assistant_msg) as assistant_message_id
FROM new_chat nc;

