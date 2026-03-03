-- ============================================================================
-- Query: get_message_list_view
-- Purpose: Fetch message-level data from messages_mv with declarative filters
-- Section: VIEWS/MESSAGE/LIST
--
-- Includes:
-- - Filtering (run_id, run_ids batch)
-- - Ordering (by run_id, role precedence, then created_at)
-- - Pagination
--
-- Note: Returns pre-aggregated upload IDs by media type from messages_mv.
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
        WHERE proname = 'api_get_message_list_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_message_list_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_message_list_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_message_list_view_v4_item AS (
    message_id uuid,
    run_id uuid,
    role text,
    message_created_at timestamptz,
    text_upload_ids uuid[],
    audio_upload_ids uuid[],
    image_upload_ids uuid[],
    video_upload_ids uuid[],
    file_upload_ids uuid[],
    call_upload_ids uuid[]
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_message_list_view_v4(
    run_id_filter uuid DEFAULT NULL,
    run_ids uuid[] DEFAULT NULL,
    page_limit_val int DEFAULT 10000,
    page_offset_val int DEFAULT 0
)
RETURNS TABLE (
    items types.q_get_message_list_view_v4_item[],
    total_count int
)
LANGUAGE sql
STABLE
AS $$
    WITH
    filtered AS (
        SELECT mv.*
        FROM messages_mv mv
        WHERE
            (run_id_filter IS NULL OR mv.run_id = run_id_filter)
            AND (run_ids IS NULL OR mv.run_id = ANY(run_ids))
    ),
    counted AS (
        SELECT COUNT(*)::int AS total FROM filtered
    ),
    sorted AS (
        SELECT *
        FROM filtered
        ORDER BY
            run_id,
            CASE role
                WHEN 'system' THEN 1
                WHEN 'developer' THEN 2
                WHEN 'user' THEN 3
                WHEN 'assistant' THEN 4
                ELSE 5
            END,
            message_created_at
        LIMIT page_limit_val
        OFFSET page_offset_val
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    message_id,
                    run_id,
                    role,
                    message_created_at,
                    text_upload_ids,
                    audio_upload_ids,
                    image_upload_ids,
                    video_upload_ids,
                    file_upload_ids,
                    call_upload_ids
                )::types.q_get_message_list_view_v4_item
                ORDER BY
                    run_id,
                    CASE role
                        WHEN 'system' THEN 1
                        WHEN 'developer' THEN 2
                        WHEN 'user' THEN 3
                        WHEN 'assistant' THEN 4
                        ELSE 5
                    END,
                    message_created_at
            ),
            ARRAY[]::types.q_get_message_list_view_v4_item[]
        ) AS items
        FROM sorted
    )
    SELECT
        (SELECT items FROM items_agg),
        (SELECT total FROM counted);
$$;
