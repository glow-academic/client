-- Materialized View: mv_metrics_daily_agg
-- Pre-aggregates app metrics per day for long-term analytics.
-- Uses idempotent drop/recreate pattern - safe to run multiple times.
--
-- Key: (day)
-- Source: app_metrics table (direct, not from hourly MV for accuracy)
--
-- Columns:
--   day                 - DATE_TRUNC('day', ts)
--   sample_count        - Number of samples in day
--   total_requests      - SUM of requests (delta from first to last in day)
--   total_errors        - SUM of errors (delta from first to last in day)
--   avg_latency_ms      - Average latency
--   max_latency_ms      - Max latency
--   avg_cpu_percent     - Average CPU usage
--   max_cpu_percent     - Max CPU usage
--   avg_memory_bytes    - Average memory usage
--   max_memory_bytes    - Max memory usage
-- ============================================================================
-- Step 1: Drop all indexes on mv_metrics_daily_agg materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_metrics_daily_agg'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop mv_metrics_daily_agg materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_metrics_daily_agg CASCADE;

-- ============================================================================
-- Step 3: Create mv_metrics_daily_agg Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW mv_metrics_daily_agg AS
WITH
-- Calculate daily deltas (requests/errors are cumulative counters)
daily_boundaries AS (
    SELECT
        DATE_TRUNC('day', ts) AS day,
        MIN(ts) AS first_ts,
        MAX(ts) AS last_ts
    FROM app_metrics
    GROUP BY DATE_TRUNC('day', ts)
),
daily_deltas AS (
    SELECT
        db.day,
        -- Get delta from first to last sample (cumulative counters)
        (SELECT requests_total FROM app_metrics WHERE ts = db.last_ts) -
        (SELECT requests_total FROM app_metrics WHERE ts = db.first_ts) AS total_requests,
        (SELECT errors_total FROM app_metrics WHERE ts = db.last_ts) -
        (SELECT errors_total FROM app_metrics WHERE ts = db.first_ts) AS total_errors
    FROM daily_boundaries db
)
SELECT
    DATE_TRUNC('day', am.ts) AS day,
    COUNT(*)::int AS sample_count,
    -- Request/error deltas from boundaries
    COALESCE(dd.total_requests, 0)::bigint AS total_requests,
    COALESCE(dd.total_errors, 0)::bigint AS total_errors,
    -- Latency metrics
    AVG(am.avg_latency_ms)::double precision AS avg_latency_ms,
    MAX(am.avg_latency_ms)::double precision AS max_latency_ms,
    -- CPU metrics
    AVG(am.cpu_percent)::double precision AS avg_cpu_percent,
    MAX(am.cpu_percent)::double precision AS max_cpu_percent,
    -- Memory metrics
    AVG(am.memory_bytes)::bigint AS avg_memory_bytes,
    MAX(am.memory_bytes)::bigint AS max_memory_bytes
FROM app_metrics am
LEFT JOIN daily_deltas dd ON dd.day = DATE_TRUNC('day', am.ts)
GROUP BY DATE_TRUNC('day', am.ts), dd.total_requests, dd.total_errors
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX mv_metrics_daily_agg_pk
    ON mv_metrics_daily_agg (day);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

-- Time range filtering
CREATE INDEX mv_metrics_daily_agg_day_idx
    ON mv_metrics_daily_agg (day DESC);

-- CPU usage filtering (find high CPU days)
CREATE INDEX mv_metrics_daily_agg_cpu_idx
    ON mv_metrics_daily_agg (avg_cpu_percent DESC);

-- Memory usage filtering (find high memory days)
CREATE INDEX mv_metrics_daily_agg_memory_idx
    ON mv_metrics_daily_agg (avg_memory_bytes DESC);

-- Latency filtering (find slow days)
CREATE INDEX mv_metrics_daily_agg_latency_idx
    ON mv_metrics_daily_agg (avg_latency_ms DESC);

-- Request volume filtering (find high traffic days)
CREATE INDEX mv_metrics_daily_agg_requests_idx
    ON mv_metrics_daily_agg (total_requests DESC);

-- Error rate filtering (find problematic days)
CREATE INDEX mv_metrics_daily_agg_errors_idx
    ON mv_metrics_daily_agg (total_errors DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW mv_metrics_daily_agg;
