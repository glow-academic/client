-- Insert an error message (assistant role) and link to run
-- Parameters: $1=run_id (uuid), $2=content (text)
-- Returns: id, created_at
-- Creates message without run_id, then links via message_runs
WITH error_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    VALUES ('assistant'::message_role, true, false, NOW(), NOW())
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, $2::text, created_at, updated_at
    FROM error_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT em.id, $1::uuid, NOW(), NOW()
    FROM error_message em
    ON CONFLICT (message_id, run_id) DO UPDATE SET updated_at = NOW()
)
SELECT id, created_at FROM error_message
