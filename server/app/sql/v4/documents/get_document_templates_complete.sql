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
    html_id uuid,
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
    dh.html_id,
    dao.args_outputs_id as template_id,  -- Using args_outputs_id as template_id for backward compatibility
    da.args_id as schema_id,  -- Using args_id as schema_id for backward compatibility
    ao.active,  -- Get active status from args_outputs_resource
    dao.created_at,
    dao.updated_at
FROM document_args_outputs dao
LEFT JOIN args_outputs_resource ao ON ao.id = dao.args_outputs_id
LEFT JOIN document_html dh ON dh.document_id = dao.document_id
LEFT JOIN document_args da ON da.document_id = dao.document_id
WHERE dao.document_id = api_get_document_templates_v4.document_id
ORDER BY dao.created_at DESC
$$;