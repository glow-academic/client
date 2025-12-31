-- Get or create group for chat and link run to it
-- Parameters: $1=chat_id (uuid), $2=run_id (uuid)
-- Returns: group_id (uuid), run_id (uuid), idx (int)
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
    RETURNING id AS group_id
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
),
target_group AS (
    SELECT group_id
    FROM selected_group
    LIMIT 1
),
link_run AS (
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT
        tg.group_id,
        $2::uuid,
        COALESCE(
            (SELECT MAX(idx) FROM group_runs WHERE group_id = tg.group_id),
            -1
        ) + 1,
        NOW(),
        NOW()
    FROM target_group tg
    ON CONFLICT (group_id, run_id) DO NOTHING
    RETURNING group_id, run_id, idx
)
SELECT
    tg.group_id::text AS group_id,
    $2::uuid::text AS run_id,
    COALESCE(lr.idx, gr.idx) AS idx
FROM target_group tg
LEFT JOIN link_run lr ON lr.group_id = tg.group_id
LEFT JOIN group_runs gr
    ON gr.group_id = tg.group_id
    AND gr.run_id = $2::uuid
LIMIT 1;
