-- Materialized View: mv_activity
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
-- Step 1: Drop all indexes on mv_activity materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_activity materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_activity CASCADE;

-- ============================================================================
-- Step 3: Create mv_activity Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_activity AS
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

CREATE UNIQUE INDEX mv_activity_pk
    ON mv_activity (activity_id);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_activity_profile_id_idx
    ON mv_activity (profile_id)
    WHERE profile_id IS NOT NULL;

CREATE INDEX mv_activity_session_id_idx
    ON mv_activity (session_id);

CREATE INDEX mv_activity_created_at_idx
    ON mv_activity (created_at DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity;
