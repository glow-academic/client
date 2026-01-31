-- Materialized View: mv_health_service_hourly
-- Hourly aggregation for HEALTH section - service status trends.
--
-- Grain: One row per (date_hour, service)
-- Purpose: Service health trend charts on health overview page
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: HEALTH
-- Source: view_health_entry aggregated by hour and service
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_health_service_hourly materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_health_service_hourly'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_health_service_hourly materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_health_service_hourly CASCADE;

-- ============================================================================
-- Step 3: Create mv_health_service_hourly Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_health_service_hourly AS
SELECT
    -- Keys
    date_trunc('hour', h.ts) AS date_hour,
    h.service,

    -- Aggregated metrics
    COUNT(*)::int AS check_count,
    COUNT(*) FILTER (WHERE h.ok = true)::int AS ok_count,
    COUNT(*) FILTER (WHERE h.ok = false)::int AS fail_count,

    -- Uptime percentage
    TRUNC((COUNT(*) FILTER (WHERE h.ok = true)::numeric / NULLIF(COUNT(*), 0)) * 100.0, 2) AS uptime_percent,

    -- Latency metrics
    TRUNC(AVG(h.latency_ms)::numeric, 2) AS avg_latency_ms,
    TRUNC(MIN(h.latency_ms)::numeric, 2) AS min_latency_ms,
    TRUNC(MAX(h.latency_ms)::numeric, 2) AS max_latency_ms,

    -- Latest status in the hour
    (ARRAY_AGG(h.ok ORDER BY h.ts DESC))[1] AS latest_ok,
    (ARRAY_AGG(h.error ORDER BY h.ts DESC))[1] AS latest_error

FROM view_health_entry h
WHERE h.service IN ('websocket', 'redis', 'tus', 'database', 'keycloak')
GROUP BY date_trunc('hour', h.ts), h.service
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_health_service_hourly_pk
    ON mv_health_service_hourly (date_hour, service);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Time-based lookup
CREATE INDEX mv_health_service_hourly_date_hour_idx
    ON mv_health_service_hourly (date_hour);

CREATE INDEX mv_health_service_hourly_date_hour_desc_idx
    ON mv_health_service_hourly (date_hour DESC);

-- Service filtering
CREATE INDEX mv_health_service_hourly_service_idx
    ON mv_health_service_hourly (service);

-- Composite: service + time for service-specific trends
CREATE INDEX mv_health_service_hourly_service_date_idx
    ON mv_health_service_hourly (service, date_hour DESC);

-- Uptime filtering (find degraded periods)
CREATE INDEX mv_health_service_hourly_uptime_idx
    ON mv_health_service_hourly (uptime_percent)
    WHERE uptime_percent < 100;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_health_service_hourly;
