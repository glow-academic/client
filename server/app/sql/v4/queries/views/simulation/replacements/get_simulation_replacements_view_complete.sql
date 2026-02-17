-- ============================================================================
-- Query: get_simulation_replacements_view
-- Purpose: Fetch replacement-level data from attempt_replacements_mv with declarative filters
-- Section: VIEWS/SIMULATION/REPLACEMENTS
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
        WHERE proname = 'api_get_simulation_replacements_view_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_simulation_replacements_view_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_simulation_replacements_view_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create composite types
-- ============================================================================

CREATE TYPE types.q_get_simulation_replacements_view_v4_item AS (
    replacement_id uuid,
    improvement_id uuid,
    section text,
    replace_text text,
    idx int,
    created_at timestamptz
);

-- ============================================================================
-- Step 4: Create function
-- ============================================================================

CREATE OR REPLACE FUNCTION api_get_simulation_replacements_view_v4(
    improvement_ids_filter uuid[]
)
RETURNS TABLE (
    items types.q_get_simulation_replacements_view_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH
    mv_data AS (
        SELECT mv.*
        FROM attempt_replacements_mv mv
        WHERE mv.improvement_id = ANY(improvement_ids_filter)
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    mv.replacement_id,
                    mv.improvement_id,
                    mv.section,
                    mv.replace_text,
                    mv.idx,
                    mv.created_at
                )::types.q_get_simulation_replacements_view_v4_item
                ORDER BY mv.improvement_id, mv.idx
            ),
            ARRAY[]::types.q_get_simulation_replacements_view_v4_item[]
        ) AS items
        FROM mv_data mv
    )
    SELECT items FROM items_agg;
$$;
