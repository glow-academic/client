-- Materialized View: health_mv
-- Hourly service health data for health pages.
--
-- Grain: One row per (date_hour, service)
-- Filter: service IN known services
--
-- Purpose: Service health trend charts on health overview page
-- Section: HEALTH (lean MV)
--
-- Dependencies: view_health_entry

CREATE MATERIALIZED VIEW health_mv AS
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
