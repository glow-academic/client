-- Get or create developer message and link to run
-- Converted to PostgreSQL function
-- Uses MD5 deduplication via message_content_hash() function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_developer_message_to_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_developer_message_to_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_link_developer_message_to_run_v4(
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