-- Get chat_id from run_id
-- Relationship: runs → group_runs → groups → chat_groups → chats
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_chat_id_from_run_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_id_from_run_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_chat_id_from_run_id_v4(
    run_id uuid
)
RETURNS TABLE (
    chat_id text
)
LANGUAGE sql
STABLE
AS $$
SELECT DISTINCT c.id::text as chat_id
FROM run_artifact r
JOIN group_runs gr ON gr.run_id = r.id
JOIN groups g ON g.id = gr.group_id
JOIN chat_groups cg ON cg.group_id = g.id
JOIN chat_artifact c ON c.id = cg.chat_id
WHERE r.id = run_id
LIMIT 1
$$;
