-- Logs bundle query - returns KPIs and metrics in single JSONB response
-- Returns: JSONB object with health KPIs and metrics time series

WITH
-- Current health status for each service (latest record per service)
current_health AS (
    SELECT DISTINCT ON (service)
        service,
        ok,
        latency_ms,
        error,
        ts
    FROM service_health
    WHERE service IN ('websocket', 'redis', 'tus', 'database', 'keycloak')
    ORDER BY service, ts DESC
),

-- Health trend data for each service (last 7 days, aggregated by hour)
health_trends AS (
    SELECT 
        service,
        date_trunc('hour', ts) as date_hour,
        COUNT(*) FILTER (WHERE ok = true)::float / NULLIF(COUNT(*), 0) * 100.0 as uptime_percent,
        AVG(latency_ms) as avg_latency_ms,
        COUNT(*) as check_count
    FROM service_health
    WHERE service IN ('websocket', 'redis', 'tus', 'database', 'keycloak')
      AND ts >= NOW() - INTERVAL '7 days'
    GROUP BY service, date_hour
    ORDER BY service, date_hour
),

-- Health trend data formatted for each service
websocket_trend AS (
    SELECT 
        to_char(date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(uptime_percent::numeric, 2)::float as value,
        ROUND(avg_latency_ms::numeric, 2)::float as latency,
        check_count::int as count
    FROM health_trends
    WHERE service = 'websocket'
    ORDER BY date_hour
),

redis_trend AS (
    SELECT 
        to_char(date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(uptime_percent::numeric, 2)::float as value,
        ROUND(avg_latency_ms::numeric, 2)::float as latency,
        check_count::int as count
    FROM health_trends
    WHERE service = 'redis'
    ORDER BY date_hour
),

document_trend AS (
    SELECT 
        to_char(date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(uptime_percent::numeric, 2)::float as value,
        ROUND(avg_latency_ms::numeric, 2)::float as latency,
        check_count::int as count
    FROM health_trends
    WHERE service = 'tus'
    ORDER BY date_hour
),

database_trend AS (
    SELECT 
        to_char(date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(uptime_percent::numeric, 2)::float as value,
        ROUND(avg_latency_ms::numeric, 2)::float as latency,
        check_count::int as count
    FROM health_trends
    WHERE service = 'database'
    ORDER BY date_hour
),

authentication_trend AS (
    SELECT 
        to_char(date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(uptime_percent::numeric, 2)::float as value,
        ROUND(avg_latency_ms::numeric, 2)::float as latency,
        check_count::int as count
    FROM health_trends
    WHERE service = 'keycloak'
    ORDER BY date_hour
),

-- App metrics time series (last 7 days, aggregated by hour)
metrics_trend AS (
    SELECT 
        date_trunc('hour', ts) as date_hour,
        AVG(cpu_percent) as avg_cpu_percent,
        AVG(avg_latency_ms) as avg_latency_ms,
        AVG(memory_bytes) as avg_memory_bytes,
        MAX(requests_total) as max_requests_total,
        MAX(errors_total) as max_errors_total,
        COUNT(*) as sample_count
    FROM app_metrics
    WHERE ts >= NOW() - INTERVAL '7 days'
    GROUP BY date_hour
    ORDER BY date_hour
),

-- Build health KPIs with current status and trends
health_kpis_data AS (
    SELECT jsonb_build_object(
        'websocket', COALESCE((
            SELECT jsonb_build_object(
                'ok', ch.ok,
                'latency_ms', ROUND(ch.latency_ms::numeric, 2)::float,
                'error', COALESCE(ch.error, ''),
                'trend', COALESCE((SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', wt.date,
                        'value', wt.value,
                        'latency', wt.latency,
                        'count', wt.count
                    ) ORDER BY wt.date
                ) FROM websocket_trend wt), '[]'::jsonb)
            )
            FROM current_health ch
            WHERE ch.service = 'websocket'
        ), jsonb_build_object('ok', false, 'latency_ms', 0, 'error', 'No data', 'trend', '[]'::jsonb)),
        'redis', COALESCE((
            SELECT jsonb_build_object(
                'ok', ch.ok,
                'latency_ms', ROUND(ch.latency_ms::numeric, 2)::float,
                'error', COALESCE(ch.error, ''),
                'trend', COALESCE((SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', rt.date,
                        'value', rt.value,
                        'latency', rt.latency,
                        'count', rt.count
                    ) ORDER BY rt.date
                ) FROM redis_trend rt), '[]'::jsonb)
            )
            FROM current_health ch
            WHERE ch.service = 'redis'
        ), jsonb_build_object('ok', false, 'latency_ms', 0, 'error', 'No data', 'trend', '[]'::jsonb)),
        'document', COALESCE((
            SELECT jsonb_build_object(
                'ok', ch.ok,
                'latency_ms', ROUND(ch.latency_ms::numeric, 2)::float,
                'error', COALESCE(ch.error, ''),
                'trend', COALESCE((SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', dt.date,
                        'value', dt.value,
                        'latency', dt.latency,
                        'count', dt.count
                    ) ORDER BY dt.date
                ) FROM document_trend dt), '[]'::jsonb)
            )
            FROM current_health ch
            WHERE ch.service = 'tus'
        ), jsonb_build_object('ok', false, 'latency_ms', 0, 'error', 'No data', 'trend', '[]'::jsonb)),
        'database', COALESCE((
            SELECT jsonb_build_object(
                'ok', ch.ok,
                'latency_ms', ROUND(ch.latency_ms::numeric, 2)::float,
                'error', COALESCE(ch.error, ''),
                'trend', COALESCE((SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', dbt.date,
                        'value', dbt.value,
                        'latency', dbt.latency,
                        'count', dbt.count
                    ) ORDER BY dbt.date
                ) FROM database_trend dbt), '[]'::jsonb)
            )
            FROM current_health ch
            WHERE ch.service = 'database'
        ), jsonb_build_object('ok', false, 'latency_ms', 0, 'error', 'No data', 'trend', '[]'::jsonb)),
        'authentication', COALESCE((
            SELECT jsonb_build_object(
                'ok', ch.ok,
                'latency_ms', ROUND(ch.latency_ms::numeric, 2)::float,
                'error', COALESCE(ch.error, ''),
                'trend', COALESCE((SELECT jsonb_agg(
                    jsonb_build_object(
                        'date', at.date,
                        'value', at.value,
                        'latency', at.latency,
                        'count', at.count
                    ) ORDER BY at.date
                ) FROM authentication_trend at), '[]'::jsonb)
            )
            FROM current_health ch
            WHERE ch.service = 'keycloak'
        ), jsonb_build_object('ok', false, 'latency_ms', 0, 'error', 'No data', 'trend', '[]'::jsonb))
    ) as kpis
)

-- Build final JSONB response
SELECT jsonb_build_object(
    'health_kpis', (SELECT kpis FROM health_kpis_data),
    'metrics', (
        SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
                'date', to_char(mt.date_hour, 'YYYY-MM-DD HH24:MI:SS'),
                'cpu_percent', ROUND(mt.avg_cpu_percent::numeric, 2)::float,
                'latency_ms', ROUND(mt.avg_latency_ms::numeric, 2)::float,
                'memory_bytes', ROUND(mt.avg_memory_bytes::numeric, 0)::bigint,
                'requests_total', mt.max_requests_total,
                'errors_total', mt.max_errors_total,
                'sample_count', mt.sample_count
            ) ORDER BY mt.date_hour
        ), '[]'::jsonb)
        FROM metrics_trend mt
    )
) as result;

