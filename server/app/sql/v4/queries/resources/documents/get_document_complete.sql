-- Get document resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single document resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_document_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_document_resource_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_document_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for document item
CREATE TYPE types.q_get_document_resource_v4_item AS (
    document_id uuid,
    name text,
    description text,
    file_path text,
    mime_type text,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_document_resource_v4(
    id uuid
)
RETURNS TABLE (
    item types.q_get_document_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        d.id,
        (SELECT n.name FROM document_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.document_id = d.id LIMIT 1),
        COALESCE((SELECT desc.description FROM document_descriptions_junction dd JOIN descriptions_resource desc ON dd.description_id = desc.id WHERE dd.document_id = d.id LIMIT 1), ''),
        d.file_path,
        d.mime_type,
        COALESCE(d.generated, false)
    )::types.q_get_document_resource_v4_item as item
FROM documents_resource d
WHERE d.id = id
  AND d.active = true;
$$;
