-- Materialized View: mv_health_hourly_agg
-- Pre-aggregates health check results per service per hour for trend analysis.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key: (hour, service)
-- Source: health_entry table
--
-- Columns:
--   hour                - DATE_TRUNC('hour', ts)
--   service             - 'websocket' | 'redis' | 'tus' | 'database' | 'keycloak'
--   check_count         - Total health checks in hour
--   success_count       - Checks where ok = true
--   failure_count       - Checks where ok = false
--   uptime_percent      - (success_count / check_count) * 100
--   avg_latency_ms      - Average latency
--   min_latency_ms      - Min latency
--   max_latency_ms      - Max latency
--   p95_latency_ms      - 95th percentile latency
--   last_error          - Most recent error message (if any)
-- ============================================================================
-- Step 1: Drop all indexes on mv_health_hourly_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_health_hourly_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_health_hourly_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_health_hourly_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_health_hourly_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_health_hourly_agg AS
WITH
-- Pre-compute aggregates
hourly_stats AS (
    SELECT
        DATE_TRUNC('hour', ts) AS hour,
        service,
        COUNT(*)::int AS check_count,
        COUNT(*) FILTER (WHERE ok = true)::int AS success_count,
        COUNT(*) FILTER (WHERE ok = false)::int AS failure_count,
        AVG(latency_ms)::double precision AS avg_latency_ms,
        MIN(latency_ms)::double precision AS min_latency_ms,
        MAX(latency_ms)::double precision AS max_latency_ms,
        -- Percentile calculation for p95
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::double precision AS p95_latency_ms
    FROM health_entry
    GROUP BY DATE_TRUNC('hour', ts), service
),
-- Get last error per hour/service (most recent non-empty error)
last_errors AS (
    SELECT DISTINCT ON (DATE_TRUNC('hour', ts), service)
        DATE_TRUNC('hour', ts) AS hour,
        service,
        error AS last_error
    FROM health_entry
    WHERE error != ''
    ORDER BY DATE_TRUNC('hour', ts), service, ts DESC
)
SELECT
    hs.hour,
    hs.service,
    hs.check_count,
    hs.success_count,
    hs.failure_count,
    CASE
        WHEN hs.check_count = 0 THEN 0
        ELSE TRUNC((hs.success_count::numeric / hs.check_count) * 100.0, 2)
    END AS uptime_percent,
    hs.avg_latency_ms,
    hs.min_latency_ms,
    hs.max_latency_ms,
    hs.p95_latency_ms,
    COALESCE(le.last_error, '')::text AS last_error
FROM hourly_stats hs
LEFT JOIN last_errors le ON le.hour = hs.hour AND le.service = hs.service
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_health_hourly_agg_pk
    ON mv_health_hourly_agg (hour, service);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Service filtering
CREATE INDEX mv_health_hourly_agg_service_idx
    ON mv_health_hourly_agg (service);

-- Time range filtering
CREATE INDEX mv_health_hourly_agg_hour_idx
    ON mv_health_hourly_agg (hour DESC);

-- Composite for service + time queries
CREATE INDEX mv_health_hourly_agg_service_hour_idx
    ON mv_health_hourly_agg (service, hour DESC);

-- Uptime filtering (find degraded periods)
CREATE INDEX mv_health_hourly_agg_uptime_idx
    ON mv_health_hourly_agg (uptime_percent)
    WHERE uptime_percent < 100;

-- Latency filtering (find slow periods)
CREATE INDEX mv_health_hourly_agg_latency_idx
    ON mv_health_hourly_agg (avg_latency_ms DESC);

-- Failure count filtering (find problematic periods)
CREATE INDEX mv_health_hourly_agg_failures_idx
    ON mv_health_hourly_agg (failure_count DESC)
    WHERE failure_count > 0;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_health_hourly_agg;
