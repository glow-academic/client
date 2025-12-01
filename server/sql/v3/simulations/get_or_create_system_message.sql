-- Get or create a system message with MD5 deduplication
-- Parameters: $1=content (text)
-- Returns: id, created_at
-- Uses message_content_hash() function for deduplication
WITH content_hash AS (
    SELECT message_content_hash($1::text, 'system') as hash
),
existing_message AS (
    SELECT m.id, m.created_at
    FROM messages m, content_hash ch
    WHERE m.role = 'system'
    AND message_content_hash(m.content, 'system') = ch.hash
    LIMIT 1
),
new_message AS (
    INSERT INTO messages (role, content, completed, audio, created_at, updated_at)
    SELECT 'system'::message_role, $1::text, false, false, NOW(), NOW()
    WHERE NOT EXISTS (SELECT 1 FROM existing_message)
    RETURNING id, created_at
)
SELECT id, created_at FROM existing_message
UNION ALL
SELECT id, created_at FROM new_message

