-- Get parent document template info for dynamic document creation
-- Converted to PostgreSQL function
-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_document_template_info_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_template_info_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Recreate function
CREATE OR REPLACE FUNCTION api_get_document_template_info_v4(
    parent_document_id uuid
)
RETURNS TABLE (
    file_path text,
    schema_id uuid,
    classify_agent_id text,
    document_agent_id text,
    name text,
    description text
)
LANGUAGE sql
STABLE
AS $$
SELECT 
    u.file_path,
    dt.schema_id,
    d.classify_agent_id::text,
    d.document_agent_id::text,
    d.name,
    d.description
FROM documents d
INNER JOIN document_templates dt ON dt.document_id = d.id AND dt.active = true
INNER JOIN html h ON h.id = dt.html_id
INNER JOIN html_uploads hu ON hu.html_id = h.id AND hu.active = true
INNER JOIN uploads u ON u.id = hu.upload_id
WHERE d.id = parent_document_id
ORDER BY dt.created_at DESC
LIMIT 1
$$;