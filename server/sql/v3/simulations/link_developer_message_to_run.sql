-- Get or create developer message and link to run
-- Parameters: $1=content (text), $2=run_id (uuid)
-- Returns: message_id, run_id
-- Uses MD5 deduplication via message_content_hash() function
WITH content_hash AS (
    SELECT message_content_hash($1::text, 'developer') as hash
),
existing_message AS (
    SELECT m.id, m.created_at
    FROM messages m, content_hash ch
    WHERE m.role = 'developer'
    AND message_content_hash(m.content, 'developer') = ch.hash
    LIMIT 1
),
new_message AS (
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    SELECT 'developer'::message_role, $1::text, false, false, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_message)
    RETURNING id, created_at
),
developer_msg AS (
    SELECT id, created_at FROM existing_message
    UNION ALL
    SELECT id, created_at FROM new_message
),
link_to_run AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT dm.id, $2::uuid, NOW(), NOW()
    FROM developer_msg dm
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
    RETURNING message_id, run_id
)
SELECT message_id, run_id FROM link_to_run

