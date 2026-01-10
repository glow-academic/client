-- Mark chat as completed
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_update_chat_completed_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_update_chat_completed_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_update_chat_completed_v4(
    chat_id uuid
)
RETURNS TABLE (
    id uuid,
    completed boolean
)
LANGUAGE sql
VOLATILE
AS $$
UPDATE chat 
SET completed = true 
WHERE id = chat_id
RETURNING id, completed
$$;