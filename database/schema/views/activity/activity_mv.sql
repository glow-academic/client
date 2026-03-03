-- Materialized View: activity_mv
-- Lean activity-level data for activity views.
--
-- Grain: One row per activity entry
-- Filter: active = true only
--
-- Purpose: Activity data with profile_id and session_id
-- Section: ACTIVITY (lean MV)
--
-- Dependencies: activity_entry, profiles_activity_connection
-- ============================================================================
-- Step 1: Drop all indexes on activity_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'activity_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop activity_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS activity_mv CASCADE;

-- ============================================================================
-- Step 3: Create activity_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW activity_mv AS
SELECT
    a.id          AS activity_id,
    pac.profiles_id AS profile_id,
    a.session_id,
    a.last_active,
    a.created_at
FROM activity_entry a
LEFT JOIN profiles_activity_connection pac
    ON pac.activity_id = a.id
    AND pac.active = true
WHERE a.active = true
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX activity_mv_pk
    ON activity_mv (activity_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX activity_mv_profile_id_idx
    ON activity_mv (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX activity_mv_session_id_idx
    ON activity_mv (session_id);

CREATE INDEX activity_mv_created_at_idx
    ON activity_mv (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW activity_mv;
