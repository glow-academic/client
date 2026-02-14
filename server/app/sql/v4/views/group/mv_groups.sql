-- Materialized View: mv_groups
-- Lean group-level data for group pages.
--
-- Grain: One row per active group
-- Filter: active = TRUE only
--
-- Purpose: Provides group-level IDs + timestamps for parallel fetching
-- Section: GROUP (lean MV - aggregates computed in Python)
--
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on mv_groups materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_groups'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_groups materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_groups CASCADE;

-- ============================================================================
-- Step 3: Create mv_groups Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_groups AS
SELECT
    -- Primary key
    g.id AS group_id,

    -- Session ID (nullable)
    g.session_id,

    -- Timestamps
    g.created_at AS group_created_at,

    -- Group metadata
    g.trace_id,
    g.name AS group_name,

    -- Active flag
    g.active

FROM groups_entry g
WHERE g.active = TRUE
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_groups_pk
    ON mv_groups (group_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Session ID for filtering (partial - only non-null)
CREATE INDEX mv_groups_session_id_idx
    ON mv_groups (session_id)
    WHERE session_id IS NOT NULL;

-- Timestamp for sorting
CREATE INDEX mv_groups_created_at_idx
    ON mv_groups (group_created_at DESC);

-- Composite: session + created_at (common query pattern)
CREATE INDEX mv_groups_session_created_at_idx
    ON mv_groups (session_id, group_created_at DESC)
    WHERE session_id IS NOT NULL;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_groups;
