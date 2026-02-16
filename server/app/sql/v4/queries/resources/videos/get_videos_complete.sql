-- Get videos resources by IDs (batch)
-- Simple data fetching - no business logic, no active flag check
-- Parameters: p_ids (uuid[]) - using p_ids to avoid shadowing video_id field
-- Returns: items (array of video resources)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_videos_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_videos_v4(%s)', r.sig);
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
        WHERE proname = 'api_search_videos_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_videos_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_videos_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- Create composite type for video item (upload_id is denormalized on resource table)
CREATE TYPE types.q_get_videos_v4_item AS (
    video_id uuid,
    name text,
    description text,
    upload_id uuid,
    generated boolean
);

-- Create function (uses denormalized upload_id directly from videos_resource)
CREATE OR REPLACE FUNCTION api_get_videos_v4(
    p_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    items types.q_get_videos_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
SELECT COALESCE(
    ARRAY_AGG(
        (
            v.id,
            v.name,
            COALESCE(v.description, ''),
            v.upload_id,
            COALESCE(v.generated, false)
        )::types.q_get_videos_v4_item
        ORDER BY array_position(p_ids, v.id)
    ),
    ARRAY[]::types.q_get_videos_v4_item[]
) as items
FROM videos_resource v
WHERE v.id = ANY(p_ids);
$$;
