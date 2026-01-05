-- Get document templates
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_document_templates_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_templates_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_document_templates_v4(
    document_id uuid
)
RETURNS TABLE (
    upload_id uuid,
    template_id uuid,
    schema_id uuid,
    active boolean,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
SELECT
    t.upload_id,
    t.id as template_id,
    ts.schema_id,
    dt.active,
    dt.created_at,
    dt.updated_at
FROM document_templates dt
JOIN templates t ON t.id = dt.template_id
LEFT JOIN template_schemas ts ON ts.template_id = t.id
WHERE dt.document_id = document_id
ORDER BY dt.created_at DESC
$$;