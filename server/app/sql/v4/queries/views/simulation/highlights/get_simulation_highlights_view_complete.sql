-- ============================================================================
-- Query: get_simulation_highlights_view
-- Purpose: Fetch highlight data from mv_attempt_highlights
-- Section: VIEWS/SIMULATION/HIGHLIGHTS
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
        WHERE proname = 'api_get_simulation_highlights_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_highlights_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_highlights_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_highlights_view_v4_item AS (
    highlight_id uuid,
    strength_id uuid,
    section text,
    idx int,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_highlights_view_v4(
    strength_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_highlights_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM mv_attempt_highlights mv
        WHERE mv.strength_id = ANY(strength_ids_filter)
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.highlight_id,
                    mv.strength_id,
                    mv.section,
                    mv.idx,
                    mv.created_at
                )::types.q_get_simulation_highlights_view_v4_item
                ORDER BY mv.strength_id, mv.idx
            ),
            ARRAY[]::types.q_get_simulation_highlights_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
