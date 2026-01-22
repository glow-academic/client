-- Create a test simulation chat
-- Parameters: $1 = scenario_id (UUID), $2 = attempt_id (UUID, optional), $3 = completed (bool, optional), $4 = title (text, optional)
-- Returns: chat_id (UUID)
WITH inserted_chat AS (
    INSERT INTO chats_entry(title, scenario_id, completed)
    VALUES (
        COALESCE($4, 'Test Chat'),
        $1::uuid,
        COALESCE($3, false)
    )
    RETURNING id
),
create_group AS (
    INSERT INTO groups_entry (created_at, updated_at, trace_id)
    VALUES (NOW(), NOW(), 'test-trace-id')
    RETURNING id as group_id
),
link_chat_group AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT ic.id, cg.group_id, NOW(), NOW()
    FROM inserted_chat ic
    CROSS JOIN create_group cg
    RETURNING chat_id
)
SELECT id FROM inserted_chat;

