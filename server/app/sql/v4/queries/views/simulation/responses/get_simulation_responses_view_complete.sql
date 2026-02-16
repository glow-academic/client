-- ============================================================================
-- Query: get_simulation_responses_view
-- Purpose: Fetch response-level data from mv_simulation_responses with declarative filters
-- Section: VIEWS/SIMULATION/RESPONSES
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
        WHERE proname = 'api_get_simulation_responses_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_responses_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_responses_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_responses_view_v4_item AS (
    response_id uuid,
    chat_id uuid,
    question_id uuid,
    option_id uuid,
    completed boolean,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_responses_view_v4(
    chat_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_responses_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM mv_simulation_responses mv
        WHERE mv.chat_id = ANY(chat_ids_filter)
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.response_id,
                    mv.chat_id,
                    mv.question_id,
                    mv.option_id,
                    mv.completed,
                    mv.created_at
                )::types.q_get_simulation_responses_view_v4_item
                ORDER BY mv.chat_id, mv.created_at
            ),
            ARRAY[]::types.q_get_simulation_responses_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
