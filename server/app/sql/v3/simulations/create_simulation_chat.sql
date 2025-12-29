-- Create simulation chat, create/get group with trace_id, and link via junction tables in a single transaction
-- Parameters: $1=created_at (timestamp with time zone), $2=title (text), $3=scenario_id (uuid), $4=attempt_id (uuid), $5=completed (boolean), $6=trace_id (text)
-- Returns: id, created_at, updated_at, title, scenario_id, attempt_id, completed, trace_id
WITH inserted_chat AS (
    INSERT INTO chats (created_at, title, scenario_id, completed, updated_at)
    VALUES ($1::timestamp with time zone, $2::text, $3::uuid, $5::bool, NOW())
    RETURNING id, created_at, updated_at, title, scenario_id, completed
),
create_group_if_needed AS (
    INSERT INTO groups (created_at, updated_at, trace_id)
    VALUES (NOW(), NOW(), $6::text)
    RETURNING id as group_id, trace_id
),
create_chat_group_if_needed AS (
    INSERT INTO chat_groups (chat_id, group_id, created_at, updated_at)
    SELECT ic.id, cg.group_id, ic.created_at, ic.updated_at
    FROM inserted_chat ic
    CROSS JOIN create_group_if_needed cg
    ON CONFLICT (chat_id, group_id) DO NOTHING
    RETURNING group_id
),
final_group AS (
    SELECT group_id FROM create_chat_group_if_needed
    LIMIT 1
),
inserted_junction AS (
    INSERT INTO attempt_chats (attempt_id, chat_id, created_at, updated_at)
    SELECT $4::uuid, ic.id, ic.created_at, ic.updated_at
    FROM inserted_chat ic
    RETURNING chat_id, attempt_id
)
SELECT 
    ic.id,
    ic.created_at,
    ic.updated_at,
    ic.title,
    ic.scenario_id,
    ij.attempt_id,
    ic.completed,
    g.trace_id
FROM inserted_chat ic
JOIN inserted_junction ij ON ij.chat_id = ic.id
CROSS JOIN final_group fg
JOIN groups g ON g.id = fg.group_id

