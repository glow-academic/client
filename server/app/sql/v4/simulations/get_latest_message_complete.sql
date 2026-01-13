-- Get the latest message(s) for a chat (messages with no active children in message_tree)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_latest_message_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_latest_message_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_latest_message_v4(
    chat_id uuid
)
RETURNS TABLE (
    id uuid,
    chat_id uuid,
    role text,
    content text,
    created_at timestamptz,
    completed boolean,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    m.id,
    c.id AS chat_id,
    m.role,
    cnt.content,
    m.created_at,
    m.completed,
    m.updated_at
FROM chat_artifact c
JOIN chat_groups cg ON cg.chat_id = c.id
JOIN groups g ON g.id = cg.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN run_artifact r ON r.id = gr.run_id
JOIN message_runs mr ON mr.run_id = r.id
JOIN message_artifact m ON m.id = mr.message_id
LEFT JOIN message_contents mc ON mc.message_id = m.id AND mc.idx = 0
        LEFT JOIN contents cnt ON cnt.id = mc.content_id
WHERE c.id = chat_id
  AND NOT EXISTS (
      SELECT 1 FROM message_tree mt 
      WHERE mt.parent_id = m.id AND mt.active = true
  )
ORDER BY m.created_at DESC
LIMIT 1
$$;