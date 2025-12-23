-- Create or get developer message with multiple content entries and link to multiple runs
-- Parameters: $1=document_id (uuid), $2=content_array (text[]), $3=run_ids_array (uuid[])
-- Returns: message_id
-- Uses MD5 deduplication via message_content_hash() function on first content
-- Creates message with multiple content entries (idx=0, 1, 2, etc.)
-- Links message to all provided runs via message_runs junction table
WITH first_content AS (
    SELECT ($2::text[])[1] as first_content_text
),
content_hash AS (
    SELECT message_content_hash(first_content_text, 'developer') as hash
    FROM first_content
    WHERE $2::text[] IS NOT NULL AND array_length($2::text[], 1) > 0
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
    AND $2::text[] IS NOT NULL 
    AND array_length($2::text[], 1) > 0
    RETURNING id, created_at, updated_at
),
insert_content AS (
    INSERT INTO message_content (message_id, idx, content, created_at, updated_at)
    SELECT 
        nm.id,
        (row_number() OVER (ORDER BY idx) - 1)::integer as idx,
        content_text,
        nm.created_at,
        nm.updated_at
    FROM new_message nm
    CROSS JOIN unnest($2::text[]) WITH ORDINALITY AS t(content_text, idx)
    WHERE NOT EXISTS (SELECT 1 FROM existing_message)
),
developer_msg AS (
    SELECT id, created_at FROM existing_message
    UNION ALL
    SELECT id, created_at FROM new_message
),
link_to_runs AS (
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    SELECT 
        dm.id,
        run_id,
        NOW(),
        NOW()
    FROM developer_msg dm
    CROSS JOIN unnest($3::uuid[]) AS run_id
    WHERE $3::uuid[] IS NOT NULL 
    AND array_length($3::uuid[], 1) > 0
    ON CONFLICT (message_id, run_id) 
    DO UPDATE SET updated_at = NOW()
)
SELECT id as message_id FROM developer_msg LIMIT 1

