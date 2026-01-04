-- Insert document_uploads junction record
-- Converted to PostgreSQL function
-- Links a document to a regular upload (not a template upload)
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_insert_document_upload_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_insert_document_upload_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_insert_document_upload_v4(
    document_id uuid,
    upload_id uuid,
    active boolean
)
RETURNS TABLE (
    document_id uuid,
    upload_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
VOLATILE
AS $$
INSERT INTO document_uploads (document_id, upload_id, active, created_at, updated_at)
VALUES (api_insert_document_upload_v4.document_id, api_insert_document_upload_v4.upload_id, api_insert_document_upload_v4.active, NOW(), NOW())
ON CONFLICT (document_id, upload_id) DO UPDATE SET
    active = EXCLUDED.active,
    updated_at = NOW()
RETURNING document_id, upload_id, active, created_at, updated_at
$$;