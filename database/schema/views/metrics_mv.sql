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
