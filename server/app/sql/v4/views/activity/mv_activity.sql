-- Materialized View: mv_activity
-- Daily aggregation for activity event trend charts.
--
-- Grain: One row per (date, event_type)
-- Filter: endpoint IS NOT NULL
--
-- Purpose: Event trend charts on activity overview page
-- Section: ACTIVITY (lean MV)
--
-- Dependencies: audits_entry, sessions_entry
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
    (a.created_at::date) AS date_key,
    a.endpoint AS event_type,
    COUNT(*)::int AS event_count,
    COUNT(DISTINCT s.profile_id)::int AS unique_profiles,
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

CREATE UNIQUE INDEX mv_activity_pk
    ON mv_activity (date_key, event_type);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_activity_date_key_idx
    ON mv_activity (date_key DESC);

CREATE INDEX mv_activity_event_type_idx
    ON mv_activity (event_type);

CREATE INDEX mv_activity_date_event_idx
    ON mv_activity (date_key DESC, event_type);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_activity;
