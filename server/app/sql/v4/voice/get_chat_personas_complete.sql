-- Get all personas for a chat's scenario
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_chat_personas_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_chat_personas_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_chat_personas_v4(
    chat_id uuid
)
RETURNS TABLE (
    persona_id text,
    persona_name text
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    p.id::text as persona_id,
    p.name as persona_name
FROM chats c
JOIN scenario_personas sp ON sp.scenario_id = c.scenario_id AND sp.active = true
JOIN personas p ON p.id = sp.persona_id
WHERE c.id = chat_id
  AND p.active = true
ORDER BY p.name
$$;