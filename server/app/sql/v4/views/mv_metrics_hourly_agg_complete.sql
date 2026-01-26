-- Materialized View: mv_metrics_hourly_agg
-- Pre-aggregates app metrics per hour for trend analysis.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key: (hour)
-- Source: metrics_entry table
--
-- Columns:
--   hour                - DATE_TRUNC('hour', ts)
--   sample_count        - Number of samples in hour
--   avg_requests_total  - Average request count
--   max_requests_total  - Max request count
--   avg_errors_total    - Average error count
--   avg_latency_ms      - Average latency
--   max_latency_ms      - Max latency
--   avg_cpu_percent     - Average CPU usage
--   max_cpu_percent     - Max CPU usage
--   avg_memory_bytes    - Average memory usage
--   max_memory_bytes    - Max memory usage
-- ============================================================================
-- Step 1: Drop all indexes on mv_metrics_hourly_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_metrics_hourly_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_metrics_hourly_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_metrics_hourly_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_metrics_hourly_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_metrics_hourly_agg AS
SELECT
    DATE_TRUNC('hour', ts) AS hour,
    COUNT(*)::int AS sample_count,
    -- Request metrics
    AVG(requests_total)::bigint AS avg_requests_total,
    MAX(requests_total)::bigint AS max_requests_total,
    -- Error metrics
    AVG(errors_total)::bigint AS avg_errors_total,
    MAX(errors_total)::bigint AS max_errors_total,
    -- Latency metrics
    AVG(avg_latency_ms)::double precision AS avg_latency_ms,
    MAX(avg_latency_ms)::double precision AS max_latency_ms,
    -- CPU metrics
    AVG(cpu_percent)::double precision AS avg_cpu_percent,
    MAX(cpu_percent)::double precision AS max_cpu_percent,
    -- Memory metrics
    AVG(memory_bytes)::bigint AS avg_memory_bytes,
    MAX(memory_bytes)::bigint AS max_memory_bytes
FROM metrics_entry
GROUP BY DATE_TRUNC('hour', ts)
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_metrics_hourly_agg_pk
    ON mv_metrics_hourly_agg (hour);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Time range filtering
CREATE INDEX mv_metrics_hourly_agg_hour_idx
    ON mv_metrics_hourly_agg (hour DESC);

-- CPU usage filtering (find high CPU periods)
CREATE INDEX mv_metrics_hourly_agg_cpu_idx
    ON mv_metrics_hourly_agg (avg_cpu_percent DESC);

-- Memory usage filtering (find high memory periods)
CREATE INDEX mv_metrics_hourly_agg_memory_idx
    ON mv_metrics_hourly_agg (avg_memory_bytes DESC);

-- Latency filtering (find slow periods)
CREATE INDEX mv_metrics_hourly_agg_latency_idx
    ON mv_metrics_hourly_agg (avg_latency_ms DESC);

-- Error rate filtering (find problematic periods)
CREATE INDEX mv_metrics_hourly_agg_errors_idx
    ON mv_metrics_hourly_agg (avg_errors_total DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_metrics_hourly_agg;
