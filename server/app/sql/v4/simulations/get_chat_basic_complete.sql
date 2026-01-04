-- Get basic chat info
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_chat_basic_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_basic_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_chat_basic_v4(
    chat_id uuid
)
RETURNS TABLE (
    id uuid,
    completed boolean,
    scenario_id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT id, completed, scenario_id
FROM chats
WHERE id = chat_id
$$;