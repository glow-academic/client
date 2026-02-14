-- Materialized View: mv_health
-- Hourly service health data for health pages.
--
-- Grain: One row per (date_hour, service)
-- Filter: service IN known services
--
-- Purpose: Service health trend charts on health overview page
-- Section: HEALTH (lean MV)
--
-- Dependencies: view_health_entry
-- ============================================================================
-- Step 1: Drop all indexes on mv_health materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_health'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_health materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_health CASCADE;

-- ============================================================================
-- Step 3: Create mv_health Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_health AS
SELECT
    date_trunc('hour', h.ts) AS date_hour,
    h.service,
    COUNT(*)::int AS check_count,
    COUNT(*) FILTER (WHERE h.ok = true)::int AS ok_count,
    COUNT(*) FILTER (WHERE h.ok = false)::int AS fail_count,
    TRUNC((COUNT(*) FILTER (WHERE h.ok = true)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS uptime_percent,
    TRUNC(AVG(h.latency_ms)::numeric, 2) AS avg_latency_ms,
    TRUNC(MIN(h.latency_ms)::numeric, 2) AS min_latency_ms,
    TRUNC(MAX(h.latency_ms)::numeric, 2) AS max_latency_ms,
    (ARRAY_AGG(h.ok ORDER BY h.ts DESC))[1] AS latest_ok,
    (ARRAY_AGG(h.error ORDER BY h.ts DESC))[1] AS latest_error
FROM health_entry h
WHERE h.service IN ('websocket', 'redis', 'tus', 'database', 'keycloak')
GROUP BY date_trunc('hour', h.ts), h.service
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_health_pk
    ON mv_health (date_hour, service);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX mv_health_date_hour_idx
    ON mv_health (date_hour DESC);

CREATE INDEX mv_health_service_idx
    ON mv_health (service);

CREATE INDEX mv_health_service_date_idx
    ON mv_health (service, date_hour DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_health;
