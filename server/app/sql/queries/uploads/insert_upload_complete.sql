-- Insert upload record
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_upload_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_upload_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_upload_v4(
    file_path text,
    mime_type text,
    size bigint
)
RETURNS TABLE (
    id text
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO uploads_entry (file_path, mime_type, size, created_at)
VALUES (file_path, mime_type, size, NOW())
RETURNING id::text as id
$$;