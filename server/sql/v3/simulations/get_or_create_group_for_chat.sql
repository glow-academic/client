-- Get or create group for chat and return group_id
-- Parameters: $1=chat_id (uuid)
-- Returns: group_id (uuid)
-- Creates group and chat_group if they don't exist, otherwise returns existing group_id
WITH chat_group AS (
    SELECT cg.group_id
    FROM chat_groups cg
    WHERE cg.chat_id = $1::uuid
    LIMIT 1
),
create_group_if_needed AS (
    INSERT INTO groups (created_at, updated_at)
    SELECT NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    RETURNING id as group_id
),
create_chat_group_if_needed AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT $1::uuid, cg.group_id, NOW(), NOW()
    FROM create_group_if_needed cg
    WHERE NOT EXISTS (SELECT 1 FROM chat_group)
    ON CONFLICT (chat_id, group_id) DO NOTHING
    RETURNING group_id
),
selected_group AS (
    SELECT group_id FROM chat_group
    UNION ALL
    SELECT group_id FROM create_group_if_needed
    UNION ALL
    SELECT group_id FROM create_chat_group_if_needed
)
SELECT group_id FROM selected_group
LIMIT 1

