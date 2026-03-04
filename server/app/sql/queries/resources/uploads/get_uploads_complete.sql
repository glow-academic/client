-- Get files resources by IDs
-- Simple data fetching from files_resource only (upload_id denormalized)
-- Parameters: ids (uuid[])
-- Returns: items (array of file resources with upload_id)

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

-- Create composite type for file item (upload_id denormalized on resource)
CREATE TYPE types.q_get_uploads_v4_item AS (
    files_id uuid,
    generated boolean
);

-- Create function — reads directly from files_resource columns
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
        (ur.id, COALESCE(ur.generated, false))::types.q_get_uploads_v4_item
        ORDER BY array_position(ids, ur.id)
    ),
    ARRAY[]::types.q_get_uploads_v4_item[]
) as items
FROM files_resource ur
WHERE ur.id = ANY(ids)
  AND ur.active = true;
$$;
