-- ============================================================================
-- Query: get_image_list_view
-- Purpose: Fetch image-level data from images_mv with declarative filters
-- Section: VIEWS/IMAGE/LIST
--
-- Includes:
-- - Filtering (uploads_id)
-- - Ordering (by created_at)
-- - Pagination
-- ============================================================================

-- ============================================================================
-- Step 1: Drop existing function
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_image_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_image_list_view_v4(%s)', r.sig);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop existing composite types
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_image_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_image_list_view_v4_item AS (
    image_id uuid,
    uploads_id uuid,
    file_path text,
    mime_type text,
    size int,
    quality_id uuid,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_image_list_view_v4(
    uploads_id_filter uuid DEFAULT NULL,
    page_limit_val int DEFAULT 10000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_image_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM images_mv mv
        WHERE
            (uploads_id_filter IS NULL OR mv.uploads_id = uploads_id_filter)
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY created_at DESC
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    image_id,
                    uploads_id,
                    file_path,
                    mime_type,
                    size,
                    quality_id,
                    created_at
                )::types.q_get_image_list_view_v4_item
                ORDER BY created_at DESC
            ),
            ARRAY[]::types.q_get_image_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
