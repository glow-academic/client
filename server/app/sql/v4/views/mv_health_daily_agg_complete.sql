-- Materialized View: mv_health_daily_agg
-- Pre-aggregates health check results per service per day for long-term analytics.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key: (day, service)
-- Source: service_health table (direct, not from hourly MV for accuracy)
--
-- Columns:
--   day                 - DATE_TRUNC('day', ts)
--   service             - 'websocket' | 'redis' | 'tus' | 'database' | 'keycloak'
--   check_count         - Total health checks in day
--   success_count       - Checks where ok = true
--   failure_count       - Checks where ok = false
--   uptime_percent      - (success_count / check_count) * 100
--   avg_latency_ms      - Average latency
--   min_latency_ms      - Min latency
--   max_latency_ms      - Max latency
--   p95_latency_ms      - 95th percentile latency
--   error_count         - Count of distinct errors
-- ============================================================================
-- Step 1: Drop all indexes on mv_health_daily_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_health_daily_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_health_daily_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_health_daily_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_health_daily_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_health_daily_agg AS
WITH
-- Pre-compute aggregates
daily_stats AS (
    SELECT
        DATE_TRUNC('day', ts) AS day,
        service,
        COUNT(*)::int AS check_count,
        COUNT(*) FILTER (WHERE ok = true)::int AS success_count,
        COUNT(*) FILTER (WHERE ok = false)::int AS failure_count,
        AVG(latency_ms)::double precision AS avg_latency_ms,
        MIN(latency_ms)::double precision AS min_latency_ms,
        MAX(latency_ms)::double precision AS max_latency_ms,
        -- Percentile calculation for p95
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)::double precision AS p95_latency_ms,
        -- Count of distinct non-empty error messages
        COUNT(DISTINCT CASE WHEN error != '' THEN error END)::int AS error_count
    FROM service_health
    GROUP BY DATE_TRUNC('day', ts), service
)
SELECT
    day,
    service,
    check_count,
    success_count,
    failure_count,
    CASE
        WHEN check_count = 0 THEN 0
        ELSE TRUNC((success_count::numeric / check_count) * 100.0, 2)
    END AS uptime_percent,
    avg_latency_ms,
    min_latency_ms,
    max_latency_ms,
    p95_latency_ms,
    error_count
FROM daily_stats
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_health_daily_agg_pk
    ON mv_health_daily_agg (day, service);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Service filtering
CREATE INDEX mv_health_daily_agg_service_idx
    ON mv_health_daily_agg (service);

-- Time range filtering
CREATE INDEX mv_health_daily_agg_day_idx
    ON mv_health_daily_agg (day DESC);

-- Composite for service + time queries
CREATE INDEX mv_health_daily_agg_service_day_idx
    ON mv_health_daily_agg (service, day DESC);

-- Uptime filtering (find degraded days)
CREATE INDEX mv_health_daily_agg_uptime_idx
    ON mv_health_daily_agg (uptime_percent)
    WHERE uptime_percent < 100;

-- Latency filtering (find slow days)
CREATE INDEX mv_health_daily_agg_latency_idx
    ON mv_health_daily_agg (avg_latency_ms DESC);

-- Error count filtering (find problematic days)
CREATE INDEX mv_health_daily_agg_errors_idx
    ON mv_health_daily_agg (error_count DESC)
    WHERE error_count > 0;

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_health_daily_agg;
