-- Materialized View: sessions_mv
-- Lean session-level data for session pages.
--
-- Grain: One row per session
-- Filter: None (active is a column, not a filter)
--
-- Purpose: Provides session-level IDs + timestamps for parallel fetching
-- Section: SESSION (lean MV - aggregates computed in Python)
--
-- Dependencies: Only uses _entry tables
-- ============================================================================
-- Step 1: Drop all indexes on sessions_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'sessions_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop sessions_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS sessions_mv CASCADE;

-- ============================================================================
-- Step 3: Create sessions_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW sessions_mv AS
SELECT
    -- Primary key
    s.id AS session_id,

    -- Profile ID (for permission checks and filtering)
    s.profile_id,

    -- Timestamps
    s.created_at AS session_created_at,

    -- Active flag
    s.active

FROM sessions_entry s
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX sessions_mv_pk
    ON sessions_mv (session_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Profile ID for permission checks and filtering
CREATE INDEX sessions_mv_profile_id_idx
    ON sessions_mv (profile_id);

-- Timestamp for sorting
CREATE INDEX sessions_mv_created_at_idx
    ON sessions_mv (session_created_at DESC);

-- Active flag for filtering
CREATE INDEX sessions_mv_active_idx
    ON sessions_mv (active);

-- Composite: profile + created_at (common query pattern)
CREATE INDEX sessions_mv_profile_created_at_idx
    ON sessions_mv (profile_id, session_created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW sessions_mv;
