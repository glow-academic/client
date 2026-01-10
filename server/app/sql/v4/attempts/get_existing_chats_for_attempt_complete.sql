-- Get all chats for an attempt
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_existing_chats_for_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_existing_chats_for_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_existing_chats_for_attempt_v4(
    attempt_id uuid
)
RETURNS TABLE (
    id uuid,
    completed boolean,
    scenario_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT sc.id, sc.completed, sc.scenario_id
FROM attempt_chats ac
JOIN chat sc ON sc.id = ac.chat_id
WHERE ac.attempt_id = attempt_id
ORDER BY sc.created_at
$$;