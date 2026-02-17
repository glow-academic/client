-- ============================================================================
-- Query: get_simulation_messages_view
-- Purpose: Fetch message-level data from mv_attempt_messages
-- Section: VIEWS/SIMULATION/MESSAGES
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
        WHERE proname = 'api_get_simulation_messages_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_messages_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_messages_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_messages_view_v4_item AS (
    message_id uuid,
    chat_id uuid,
    attempt_id uuid,
    type text,
    created_at timestamptz,
    completed boolean,
    runs_id uuid,
    text_id uuid,
    audio_id uuid,
    history_content text
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_messages_view_v4(
    attempt_id_filter uuid
)
RETURNS TABLE (
    items types.q_get_simulation_messages_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM mv_attempt_messages mv
        WHERE mv.attempt_id = attempt_id_filter
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.message_id,
                    mv.chat_id,
                    mv.attempt_id,
                    mv.type,
                    mv.created_at,
                    mv.completed,
                    mv.runs_id,
                    mv.text_id,
                    mv.audio_id,
                    mv.history_content
                )::types.q_get_simulation_messages_view_v4_item
                ORDER BY mv.chat_id, mv.created_at, mv.message_id
            ),
            ARRAY[]::types.q_get_simulation_messages_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
