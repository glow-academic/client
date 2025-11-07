-- Create simulation chat and link via junction table in a single transaction
-- Parameters: $1=created_at (timestamp with time zone), $2=title (text), $3=scenario_id (uuid), $4=attempt_id (uuid), $5=completed (boolean), $6=trace_id (text)
-- Returns: id, created_at, updated_at, title, scenario_id, attempt_id, completed, trace_id
WITH inserted_chat AS (
    INSERT INTO simulation_chats (created_at, title, scenario_id, completed, trace_id, updated_at)
    VALUES ($1::timestamp with time zone, $2::text, $3::uuid, $5::bool, $6::text, NOW())
    RETURNING id, created_at, updated_at, title, scenario_id, completed, trace_id
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
    ic.trace_id
FROM inserted_chat ic
JOIN inserted_junction ij ON ij.chat_id = ic.id

