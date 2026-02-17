-- ============================================================================
-- Query: get_attempt_messages_view
-- Purpose: Fetch message-level data from attempt_messages_mv
-- Section: VIEWS/ATTEMPT/MESSAGES
-- Note: Messages are fully denormalized - no resource JOINs needed
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
        WHERE proname = 'api_get_attempt_messages_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_attempt_messages_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_attempt_messages_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

-- Main message item type (lean - MV is now flat)
CREATE TYPE types.q_get_attempt_messages_view_v4_item AS (
    message_id uuid,
    chat_id uuid,
    attempt_id uuid,
    type text,
    created_at timestamptz,
    completed boolean,
    runs_id uuid,
    history_content text,
    audio_id uuid
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_attempt_messages_view_v4(
    attempt_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_attempt_messages_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    -- Fetch from MV filtered by attempt
    mv_data AS (
        SELECT mv.*
        FROM attempt_messages_mv mv
        WHERE mv.attempt_id = attempt_id_filter
    ),
    -- Aggregate into array
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    message_id,
                    chat_id,
                    attempt_id,
                    type,
                    created_at,
                    completed,
                    runs_id,
                    history_content,
                    audio_id
                )::types.q_get_attempt_messages_view_v4_item
                ORDER BY chat_id, created_at, message_id
            ),
            ARRAY[]::types.q_get_attempt_messages_view_v4_item[]
        ) AS items
        FROM mv_data
    )
    SELECT items FROM items_agg;
$$;
