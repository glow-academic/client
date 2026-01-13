-- Get message created_at timestamp
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_message_created_at_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_message_created_at_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_message_created_at_v4(
    message_id uuid
)
RETURNS TABLE (
    created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
SELECT created_at FROM message_artifact WHERE id = message_id
$$;