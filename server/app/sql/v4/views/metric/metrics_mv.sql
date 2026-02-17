-- Materialized View: metrics_mv
-- Hourly system metrics data for health pages.
--
-- Grain: One row per date_hour
-- Filter: none
--
-- Purpose: System metrics charts (CPU, memory, latency) on health pages
-- Section: METRIC (lean MV)
--
-- Dependencies: view_metrics_entry
-- ============================================================================
-- Step 1: Drop all indexes on metrics_mv materialized view (if it exists)
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'metrics_mv'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

-- ============================================================================
-- Step 2: Drop metrics_mv materialized view if it exists
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS metrics_mv CASCADE;

-- ============================================================================
-- Step 3: Create metrics_mv Materialized View
-- ============================================================================

CREATE MATERIALIZED VIEW metrics_mv AS
SELECT
    date_trunc('hour', m.ts) AS date_hour,
    COUNT(*)::int AS sample_count,
    TRUNC(AVG(m.cpu_percent)::numeric, 2) AS avg_cpu_percent,
    TRUNC(MIN(m.cpu_percent)::numeric, 2) AS min_cpu_percent,
    TRUNC(MAX(m.cpu_percent)::numeric, 2) AS max_cpu_percent,
    TRUNC(AVG(m.avg_latency_ms)::numeric, 2) AS avg_latency_ms,
    TRUNC(MIN(m.avg_latency_ms)::numeric, 2) AS min_latency_ms,
    TRUNC(MAX(m.avg_latency_ms)::numeric, 2) AS max_latency_ms,
    TRUNC(AVG(m.memory_bytes)::numeric, 0)::bigint AS avg_memory_bytes,
    MIN(m.memory_bytes)::bigint AS min_memory_bytes,
    MAX(m.memory_bytes)::bigint AS max_memory_bytes,
    MAX(m.requests_total)::int AS max_requests_total,
    MAX(m.errors_total)::int AS max_errors_total
FROM metrics_entry m
GROUP BY date_trunc('hour', m.ts)
WITH NO DATA;

-- ============================================================================
-- Step 4: Create Unique Index (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX metrics_mv_pk
    ON metrics_mv (date_hour);

-- ============================================================================
-- Step 5: Create Filter/Slicing Indexes
-- ============================================================================

CREATE INDEX metrics_mv_date_hour_desc_idx
    ON metrics_mv (date_hour DESC);

-- ============================================================================
-- Step 6: Refresh Materialized View with Data
-- ============================================================================

REFRESH MATERIALIZED VIEW metrics_mv;
