-- Materialized View: mv_health_metrics_hourly
-- Hourly aggregation for HEALTH section - system metrics trends.
--
-- Grain: One row per date_hour
-- Purpose: System metrics charts on health overview and list pages
--
-- This MV is INDEPENDENT - it does not depend on any other MVs.
-- Section: HEALTH
-- Source: view_metrics_entry aggregated by hour
--
-- ============================================================================
-- Step 1: Drop all indexes on mv_health_metrics_hourly materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_health_metrics_hourly'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_health_metrics_hourly materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_health_metrics_hourly CASCADE;

-- ============================================================================
-- Step 3: Create mv_health_metrics_hourly Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_health_metrics_hourly AS
SELECT
    -- Key
    date_trunc('hour', m.ts) AS date_hour,

    -- Sample count
    COUNT(*)::int AS sample_count,

    -- CPU metrics
    TRUNC(AVG(m.cpu_percent)::numeric, 2) AS avg_cpu_percent,
    TRUNC(MIN(m.cpu_percent)::numeric, 2) AS min_cpu_percent,
    TRUNC(MAX(m.cpu_percent)::numeric, 2) AS max_cpu_percent,

    -- Latency metrics
    TRUNC(AVG(m.avg_latency_ms)::numeric, 2) AS avg_latency_ms,
    TRUNC(MIN(m.avg_latency_ms)::numeric, 2) AS min_latency_ms,
    TRUNC(MAX(m.avg_latency_ms)::numeric, 2) AS max_latency_ms,

    -- Memory metrics
    TRUNC(AVG(m.memory_bytes)::numeric, 0)::bigint AS avg_memory_bytes,
    MIN(m.memory_bytes)::bigint AS min_memory_bytes,
    MAX(m.memory_bytes)::bigint AS max_memory_bytes,

    -- Request metrics (use max since these are cumulative counters)
    MAX(m.requests_total)::int AS max_requests_total,
    MAX(m.errors_total)::int AS max_errors_total

FROM view_metrics_entry m
GROUP BY date_trunc('hour', m.ts)
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_health_metrics_hourly_pk
    ON mv_health_metrics_hourly (date_hour);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Time-based lookup (primary access pattern)
CREATE INDEX mv_health_metrics_hourly_date_hour_desc_idx
    ON mv_health_metrics_hourly (date_hour DESC);

-- CPU threshold filtering
CREATE INDEX mv_health_metrics_hourly_cpu_idx
    ON mv_health_metrics_hourly (avg_cpu_percent DESC);

-- Latency threshold filtering
CREATE INDEX mv_health_metrics_hourly_latency_idx
    ON mv_health_metrics_hourly (avg_latency_ms DESC);

-- Memory threshold filtering
CREATE INDEX mv_health_metrics_hourly_memory_idx
    ON mv_health_metrics_hourly (avg_memory_bytes DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_health_metrics_hourly;
