-- Get documents resources by IDs (batch)
-- CLEAN PATTERN: Query documents_resource directly with denormalized name/description/upload_id
-- Parameters: p_ids (uuid[])
-- Returns: items (array of document resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_documents_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop search function that depends on types (must happen before type drop)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_search_documents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_documents_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_documents_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for document item
CREATE TYPE types.q_get_documents_v4_item AS (
    document_id uuid,
    name text,
    description text,
    file_path text,
    mime_type text,
    generated boolean,
    upload_id uuid,
    html boolean
);

-- Create function - query documents_resource directly with upload join
CREATE OR REPLACE FUNCTION api_get_documents_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_documents_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            d.id,
            d.name,
            COALESCE(d.description, ''),
            COALESCE(u.file_path, ''),
            COALESCE(u.mime_type, ''),
            COALESCE(d.generated, false),
            d.upload_id,
            COALESCE(d.html, false)
        )::types.q_get_documents_v4_item
        ORDER BY array_position(p_ids, d.id)
    ),
    ARRAY[]::types.q_get_documents_v4_item[]
) as items
FROM documents_resource d
LEFT JOIN view_uploads_entry u ON u.id = d.upload_id
WHERE d.id = ANY(p_ids)
  AND d.active = true
  AND d.name IS NOT NULL
  AND d.name != '';
$$;
