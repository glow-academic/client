-- Materialized View: mv_activity_daily
-- Daily aggregation for ACTIVITY section - event trend charts.
--
-- Grain: One row per (date, event_type)
-- Purpose: Event trend charts on activity overview page
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: audits_entry grouped by date and endpoint
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_activity_daily materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_daily'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_activity_daily materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_activity_daily CASCADE;

-- ============================================================================
-- Step 3: Create mv_activity_daily Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_activity_daily AS
SELECT
    -- Keys
    (a.created_at::date) AS date_key,
    a.endpoint AS event_type,

    -- Aggregated counts
    COUNT(*)::int AS event_count,
    COUNT(DISTINCT s.profile_id)::int AS unique_profiles,

    -- Categorized counts
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.saved')::int AS saved_count,
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.created')::int AS created_count,
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.duplicated')::int AS duplicated_count,
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.uploaded')::int AS uploaded_count,
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.deleted')::int AS deleted_count,
    COUNT(*) FILTER (WHERE a.endpoint LIKE '%.updated')::int AS updated_count

FROM audits_entry a
LEFT JOIN sessions_entry s ON s.id = a.session_id
WHERE a.endpoint IS NOT NULL AND a.endpoint != ''
GROUP BY (a.created_at::date), a.endpoint
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_activity_daily_pk
    ON mv_activity_daily (date_key, event_type);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Primary time-based lookup
CREATE INDEX mv_activity_daily_date_key_idx
    ON mv_activity_daily (date_key);

-- Date range queries (most common)
CREATE INDEX mv_activity_daily_date_range_idx
    ON mv_activity_daily (date_key DESC);

-- Event type filtering
CREATE INDEX mv_activity_daily_event_type_idx
    ON mv_activity_daily (event_type);

-- Composite: date + event type for specific event trends
CREATE INDEX mv_activity_daily_date_event_idx
    ON mv_activity_daily (date_key DESC, event_type);

-- Event count sorting (for top events)
CREATE INDEX mv_activity_daily_event_count_idx
    ON mv_activity_daily (event_count DESC);

-- Text pattern index for endpoint filtering
CREATE INDEX mv_activity_daily_event_type_pattern_idx
    ON mv_activity_daily (event_type text_pattern_ops);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity_daily;
