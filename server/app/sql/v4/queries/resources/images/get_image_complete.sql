-- Get image resource by ID
-- Simple data fetching for scenario two-pass architecture
-- Parameters: id (uuid)
-- Returns: item (single image resource)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_image_resource_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_image_resource_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_image_resource_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for image item
CREATE TYPE types.q_get_image_resource_v4_item AS (
    image_id uuid,
    name text,
    file_path text,
    mime_type text,
    upload_id uuid,
    generated boolean
);

-- Create function
CREATE OR REPLACE FUNCTION api_get_image_resource_v4(
    image_id uuid
)
RETURNS TABLE (
    item types.q_get_image_resource_v4_item
)
LANGUAGE sql
STABLE
AS $$
SELECT
    (
        i.id,
        i.name,
        COALESCE(u.file_path, ''),
        COALESCE(u.mime_type, ''),
        COALESCE(iuc.upload_id, i.id),
        COALESCE(i.generated, false)
    )::types.q_get_image_resource_v4_item as item
FROM images_resource i
LEFT JOIN images_uploads_connection iuc ON iuc.images_id = i.id
LEFT JOIN view_uploads_entry u ON u.id = iuc.upload_id
WHERE i.id = image_id
  AND i.active = true;
$$;
