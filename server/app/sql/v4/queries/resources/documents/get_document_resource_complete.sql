-- Get document resource by ID
-- CLEAN PATTERN: Query documents_resource only (Rule 6)
-- Parameters: document_id (uuid)
-- Returns: items (single document resource)

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
    generated boolean,
    upload_id uuid,
    text_id uuid,
    image_ids uuid[]
);

-- Create function — reads directly from documents_resource columns
CREATE OR REPLACE FUNCTION api_get_document_resource_v4(
    document_id uuid
)
RETURNS TABLE (
    items types.q_get_document_resource_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            d.id,
            COALESCE(d.name, ''),
            COALESCE(d.description, ''),
            COALESCE(d.generated, false),
            d.upload_id,
            d.text_id,
            d.image_ids
        )::types.q_get_document_resource_v4_item
    ),
    ARRAY[]::types.q_get_document_resource_v4_item[]
) as items
FROM documents_resource d
WHERE d.id = document_id
  AND d.active = true;
$$;
