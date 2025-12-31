-- Get or create developer message and link to run
-- Converted to PostgreSQL function
-- Uses safe drop/recreate pattern

BEGIN;

-- 1) Drop function first
DROP FUNCTION IF EXISTS socket_link_developer_message_to_run_v3(text, uuid);

-- 2) Recreate function
CREATE OR REPLACE FUNCTION socket_link_developer_message_to_run_v3(
    content text,
    run_id uuid
)
RETURNS TABLE (
    message_id uuid,
    run_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
WITH content_hash AS (
    SELECT message_content_hash(content, 'developer') as hash
),
existing_message AS (
    SELECT m.id, m.created_at
    FROM messages m
    JOIN message_content mc ON mc.message_id = m.id AND mc.idx = 0
    JOIN content_hash ch ON message_content_hash(mc.content, 'developer') = ch.hash
    WHERE m.role = 'developer'
    LIMIT 1
),
new_message AS (
    INSERT INTO messages (role, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, false, false, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_message)
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT id, 0, content, created_at, updated_at
    FROM new_message
),
developer_msg AS (
    SELECT id, created_at FROM existing_message
    UNION ALL
    SELECT id, created_at FROM new_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT dm.id, run_id, NOW(), NOW()
    FROM developer_msg dm
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
)
SELECT message_id, run_id FROM link_to_run
$$;

COMMIT;

