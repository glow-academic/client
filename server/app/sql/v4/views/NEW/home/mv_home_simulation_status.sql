-- Materialized View: mv_home_simulation_status
-- DEPRECATED: This MV has been removed.
--
-- Reason: This MV pre-aggregates all data without preserving dates, so it cannot
-- support date-filtered queries. The home overview endpoint requires date filtering.
--
-- Replacement: Use mv_home_attempt_history instead and aggregate at query time:
--   - Filter by attempt_created_at for date range
--   - GROUP BY simulation_id for overview
--   - This allows flexible date filtering while maintaining good performance
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_home_simulation_status materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_home_simulation_status'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_home_simulation_status materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_home_simulation_status CASCADE;

-- Note: This MV is intentionally NOT recreated. See deprecation note above.
