-- Materialized View: mv_activity_summary
-- Global summary for ACTIVITY section - overview header metrics.
--
-- Grain: Single row (global totals)
-- Purpose: Instant header metrics on activity overview page
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: ACTIVITY
-- Source: Various count aggregations
--
-- Note: This MV stores global totals that are expensive to compute on-the-fly.
-- Refresh frequently (e.g., every 5 minutes) for near-real-time metrics.
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_activity_summary materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_activity_summary'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_activity_summary materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_activity_summary CASCADE;

-- ============================================================================
-- Step 3: Create mv_activity_summary Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_activity_summary AS
WITH
-- Total sessions
sessions_total AS (
    SELECT COUNT(*)::bigint AS cnt FROM sessions_entry
),
-- Active sessions
sessions_active AS (
    SELECT COUNT(*)::bigint AS cnt FROM sessions_entry WHERE active = TRUE
),
-- Active profiles (profiles with activity records)
active_profiles AS (
    SELECT COUNT(DISTINCT profile_id)::bigint AS cnt FROM profile_activity_junction
),
-- Total logins
logins_total AS (
    SELECT COUNT(*)::bigint AS cnt FROM logins_entry
),
-- Content created (audit events for save/create/duplicate/upload)
content_created AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM audits_entry
    WHERE endpoint LIKE '%.saved'
       OR endpoint LIKE '%.created'
       OR endpoint LIKE '%.duplicated'
       OR endpoint LIKE '%.uploaded'
),
-- Problems count
problems_total AS (
    SELECT COUNT(*)::bigint AS cnt FROM problems_entry
),
-- Unresolved problems
problems_unresolved AS (
    SELECT COUNT(*)::bigint AS cnt FROM problems_entry WHERE resolved = FALSE
),
-- Last 24 hours metrics
last_24h_sessions AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM sessions_entry
    WHERE created_at >= NOW() - INTERVAL '24 hours'
),
last_24h_logins AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM logins_entry
    WHERE created_at >= NOW() - INTERVAL '24 hours'
),
last_24h_events AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM audits_entry
    WHERE created_at >= NOW() - INTERVAL '24 hours'
),
-- Last 7 days metrics
last_7d_sessions AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM sessions_entry
    WHERE created_at >= NOW() - INTERVAL '7 days'
),
last_7d_logins AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM logins_entry
    WHERE created_at >= NOW() - INTERVAL '7 days'
),
last_7d_active_profiles AS (
    SELECT COUNT(DISTINCT profile_id)::bigint AS cnt
    FROM audits_entry
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND profile_id IS NOT NULL
),
-- Snapshot timestamp
snapshot AS (
    SELECT NOW() AS refreshed_at
)
SELECT
    -- Singleton key for unique index
    1 AS id,

    -- Total counts
    (SELECT cnt FROM sessions_total) AS total_sessions,
    (SELECT cnt FROM sessions_active) AS active_sessions,
    (SELECT cnt FROM active_profiles) AS total_active_profiles,
    (SELECT cnt FROM logins_total) AS total_logins,
    (SELECT cnt FROM content_created) AS total_content_created,
    (SELECT cnt FROM problems_total) AS total_problems,
    (SELECT cnt FROM problems_unresolved) AS unresolved_problems,

    -- Last 24 hours
    (SELECT cnt FROM last_24h_sessions) AS sessions_last_24h,
    (SELECT cnt FROM last_24h_logins) AS logins_last_24h,
    (SELECT cnt FROM last_24h_events) AS events_last_24h,

    -- Last 7 days
    (SELECT cnt FROM last_7d_sessions) AS sessions_last_7d,
    (SELECT cnt FROM last_7d_logins) AS logins_last_7d,
    (SELECT cnt FROM last_7d_active_profiles) AS active_profiles_last_7d,

    -- Snapshot metadata
    (SELECT refreshed_at FROM snapshot) AS refreshed_at
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_activity_summary_pk
    ON mv_activity_summary (id);

-- ============================================================================
-- Step 5: No additional indexes needed (single row)
-- ============================================================================

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity_summary;
