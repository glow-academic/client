-- Get upload id to validate upload exists
-- Converted to PostgreSQL function

BEGIN;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_upload_id_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_upload_id_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_upload_id_v4(
    upload_id uuid
)
RETURNS TABLE (
    id uuid
)
LANGUAGE sql
STABLE
AS $$
SELECT id FROM uploads WHERE id = upload_id
$$;

COMMIT;

