-- Get the latest run for a chat (now uses groups)
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_latest_run_for_chat_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_latest_run_for_chat_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_latest_run_for_chat_v4(
    chat_id uuid
)
RETURNS TABLE (
    run_id text
)
LANGUAGE sql
STABLE
AS $$
SELECT gr.run_id::text as run_id
FROM chat c
JOIN chat_groups cg ON cg.chat_id = c.id
JOIN groups g ON g.id = cg.group_id
JOIN group_runs gr ON gr.group_id = g.id
JOIN run r ON r.id = gr.run_id
WHERE c.id = chat_id
ORDER BY r.created_at DESC
LIMIT 1
$$;