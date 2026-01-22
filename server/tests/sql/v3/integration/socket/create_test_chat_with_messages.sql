-- Create a test chat with system/user/assistant messages_entry
-- Parameters: $1 = scenario_id (UUID), $2 = run_id (UUID), $3 = attempt_id (UUID, optional)
-- Returns: chat_id (UUID), system_message_id (UUID), user_message_id (UUID), assistant_message_id (UUID)
WITH create_group AS (
    INSERT INTO groups_entry (created_at, updated_at, trace_id)
    VALUES (NOW(), NOW(), 'test-trace-id')
    RETURNING id as group_id
),
new_chat AS (
    INSERT INTO chats_entry(title, scenario_id, completed, group_id, attempt_id)
    SELECT 'Test Chat', $1::uuid, false, cg.group_id, $3::uuid
    FROM create_group cg
    RETURNING id as chat_id
),
system_msg AS (
    INSERT INTO messages_entry(role, content, run_id, created_at)
    VALUES ('system', 'You are a helpful assistant.', $2::uuid, NOW())
    RETURNING id as message_id
),
user_msg AS (
    INSERT INTO messages_entry(role, content, run_id, created_at)
    VALUES ('user', 'Hello, how are you?', $2::uuid, NOW())
    RETURNING id as message_id
),
assistant_msg AS (
    INSERT INTO messages_entry(role, content, run_id, created_at)
    VALUES ('assistant', 'I am doing well, thank you!', $2::uuid, NOW())
    RETURNING id as message_id
)
SELECT
    nc.chat_id::text as chat_id,
    (SELECT message_id::text FROM system_msg) as system_message_id,
    (SELECT message_id::text FROM user_msg) as user_message_id,
    (SELECT message_id::text FROM assistant_msg) as assistant_message_id
FROM new_chat nc;

