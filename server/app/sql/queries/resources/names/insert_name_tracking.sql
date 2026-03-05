-- Insert run, call, and connection records for name tracking
-- Parameters: $1 = group_id (uuid), $2 = tool_id (uuid), $3 = names_id (uuid)

WITH new_run AS (
    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (uuidv7(), $1, NOW(), NOW())
    RETURNING id
),
new_call AS (
    INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
    SELECT uuidv7(), 'names_' || uuidv7()::text, new_run.id, NOW()
    FROM new_run
    RETURNING id
),
link_tool AS (
    INSERT INTO tools_calls_connection (tools_id, call_id)
    SELECT $2, new_call.id FROM new_call
),
link_name AS (
    INSERT INTO names_calls_connection (names_id, call_id)
    SELECT $3, new_call.id FROM new_call
)
SELECT new_call.id AS call_id FROM new_call;
