-- Get uploads resources by IDs
-- Simple data fetching - no business logic
-- Parameters: ids (uuid[])
-- Returns: items (array of upload resources with file details)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_uploads_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_uploads_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop types WITH CASCADE (search function depends on this type)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_uploads_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Create composite type for upload item (includes file details via view_uploads_entry)
CREATE TYPE types.q_get_uploads_v4_item AS (
    uploads_id uuid,
    upload_id uuid,
    file_path text,
    mime_type text,
    size bigint,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_uploads_v4(
    ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_uploads_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (v.id, v.upload_id, v.file_path, v.mime_type, v.size, COALESCE(v.generated, false))::types.q_get_uploads_v4_item
        ORDER BY array_position(ids, v.id)
    ),
    ARRAY[]::types.q_get_uploads_v4_item[]
) as items
FROM view_uploads_entry v
WHERE v.id = ANY(ids)
  AND v.active = true;
$$;
