-- Link an existing chat to an attempt via junction table
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_link_chat_to_attempt_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_link_chat_to_attempt_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_link_chat_to_attempt_v4(
    attempt_id uuid,
    chat_id uuid
)
RETURNS TABLE (
    attempt_id uuid,
    chat_id uuid
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO attempt_chats (attempt_id, chat_id, created_at, updated_at)
VALUES (attempt_id, chat_id, NOW(), NOW())
ON CONFLICT (attempt_id, chat_id) DO NOTHING
RETURNING attempt_id, chat_id
$$;