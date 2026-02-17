-- ============================================================================
-- Query: get_simulation_contents_view
-- Purpose: Fetch content data from attempt_contents_mv
-- Section: VIEWS/SIMULATION/CONTENTS
-- Note: Flat MV - no nested arrays
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
        WHERE proname = 'api_get_simulation_contents_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_contents_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_contents_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_contents_view_v4_item AS (
    content_id uuid,
    message_id uuid,
    content text,
    persona_entry_id uuid,
    idx int,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_contents_view_v4(
    message_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_contents_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM attempt_contents_mv mv
        WHERE mv.message_id = ANY(message_ids_filter)
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.content_id,
                    mv.message_id,
                    mv.content,
                    mv.persona_entry_id,
                    mv.idx,
                    mv.created_at
                )::types.q_get_simulation_contents_view_v4_item
                ORDER BY mv.message_id, mv.idx
            ),
            ARRAY[]::types.q_get_simulation_contents_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
