-- Get images resources by IDs (batch)
-- Simple data fetching - no business logic, no active flag check
-- Parameters: p_ids (uuid[]) - using p_ids to avoid shadowing image_id field
-- Returns: items (array of image resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_images_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_images_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_images_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_images_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_images_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for image item (upload_id resolved through entry chain)
CREATE TYPE types.q_get_images_v4_item AS (
    image_id uuid,
    name text,
    description text,
    upload_id uuid,
    generated boolean
);

-- Create function (resolves upload_id through entry chain)
CREATE OR REPLACE FUNCTION api_get_images_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_images_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            i.id,
            i.name,
            COALESCE(i.description, ''),
            ie.upload_id,
            COALESCE(i.generated, false)
        )::types.q_get_images_v4_item
        ORDER BY array_position(p_ids, i.id)
    ),
    ARRAY[]::types.q_get_images_v4_item[]
) as items
FROM images_resource i
LEFT JOIN images_images_connection iic ON iic.images_id = i.id AND iic.active = true
LEFT JOIN images_entry ie ON ie.id = iic.image_id AND ie.active = true
WHERE i.id = ANY(p_ids);
$$;
