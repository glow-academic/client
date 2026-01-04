-- Get logs bundle with health KPIs and metrics
-- Converted to function with composite types (zero JSONB tolerance)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_logs_bundle_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_logs_bundle_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop types in correct order: dependent types first, then base types
-- If any other object depends on them, this will ERROR and stop the migration (good)
DROP TYPE IF EXISTS types.q_get_logs_bundle_v4_health_kpis;
DROP TYPE IF EXISTS types.q_get_logs_bundle_v4_health_kpi;
DROP TYPE IF EXISTS types.q_get_logs_bundle_v4_trend_data;
DROP TYPE IF EXISTS types.q_get_logs_bundle_v4_metrics_data_point;

-- 3) Recreate types
CREATE TYPE types.q_get_logs_bundle_v4_trend_data AS (
    date text,
    value float,
    latency float,
    count int
);

CREATE TYPE types.q_get_logs_bundle_v4_health_kpi AS (
    ok boolean,
    latency_ms float,
    error text,
    trend types.q_get_logs_bundle_v4_trend_data[]
);

CREATE TYPE types.q_get_logs_bundle_v4_health_kpis AS (
    websocket types.q_get_logs_bundle_v4_health_kpi,
    redis types.q_get_logs_bundle_v4_health_kpi,
    document types.q_get_logs_bundle_v4_health_kpi,
    database types.q_get_logs_bundle_v4_health_kpi,
    authentication types.q_get_logs_bundle_v4_health_kpi
);

CREATE TYPE types.q_get_logs_bundle_v4_metrics_data_point AS (
    date text,
    cpu_percent float,
    latency_ms float,
    memory_bytes bigint,
    requests_total int,
    errors_total int,
    sample_count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_logs_bundle_v4(profile_id uuid DEFAULT NULL)
RETURNS TABLE (
    actor_name text,
    health_kpis types.q_get_logs_bundle_v4_health_kpis,
    metrics types.q_get_logs_bundle_v4_metrics_data_point[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
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

-- Build health KPIs with composite types
websocket_kpi AS (
    SELECT 
        COALESCE((SELECT ok FROM current_health WHERE service = 'websocket' LIMIT 1), false) as ok,
        COALESCE(ROUND((SELECT latency_ms FROM current_health WHERE service = 'websocket' LIMIT 1)::numeric, 2)::float, 0.0) as latency_ms,
        COALESCE((SELECT error FROM current_health WHERE service = 'websocket' LIMIT 1), 'No data') as error,
        COALESCE(
            (SELECT ARRAY_AGG(
                (wt.date, wt.value, wt.latency, wt.count)::types.q_get_logs_bundle_v4_trend_data
                ORDER BY wt.date
            ) FROM websocket_trend wt),
            '{}'::types.q_get_logs_bundle_v4_trend_data[]
        ) as trend
),

redis_kpi AS (
    SELECT 
        COALESCE((SELECT ok FROM current_health WHERE service = 'redis' LIMIT 1), false) as ok,
        COALESCE(ROUND((SELECT latency_ms FROM current_health WHERE service = 'redis' LIMIT 1)::numeric, 2)::float, 0.0) as latency_ms,
        COALESCE((SELECT error FROM current_health WHERE service = 'redis' LIMIT 1), 'No data') as error,
        COALESCE(
            (SELECT ARRAY_AGG(
                (rt.date, rt.value, rt.latency, rt.count)::types.q_get_logs_bundle_v4_trend_data
                ORDER BY rt.date
            ) FROM redis_trend rt),
            '{}'::types.q_get_logs_bundle_v4_trend_data[]
        ) as trend
),

document_kpi AS (
    SELECT 
        COALESCE((SELECT ok FROM current_health WHERE service = 'tus' LIMIT 1), false) as ok,
        COALESCE(ROUND((SELECT latency_ms FROM current_health WHERE service = 'tus' LIMIT 1)::numeric, 2)::float, 0.0) as latency_ms,
        COALESCE((SELECT error FROM current_health WHERE service = 'tus' LIMIT 1), 'No data') as error,
        COALESCE(
            (SELECT ARRAY_AGG(
                (dt.date, dt.value, dt.latency, dt.count)::types.q_get_logs_bundle_v4_trend_data
                ORDER BY dt.date
            ) FROM document_trend dt),
            '{}'::types.q_get_logs_bundle_v4_trend_data[]
        ) as trend
),

database_kpi AS (
    SELECT 
        COALESCE((SELECT ok FROM current_health WHERE service = 'database' LIMIT 1), false) as ok,
        COALESCE(ROUND((SELECT latency_ms FROM current_health WHERE service = 'database' LIMIT 1)::numeric, 2)::float, 0.0) as latency_ms,
        COALESCE((SELECT error FROM current_health WHERE service = 'database' LIMIT 1), 'No data') as error,
        COALESCE(
            (SELECT ARRAY_AGG(
                (dbt.date, dbt.value, dbt.latency, dbt.count)::types.q_get_logs_bundle_v4_trend_data
                ORDER BY dbt.date
            ) FROM database_trend dbt),
            '{}'::types.q_get_logs_bundle_v4_trend_data[]
        ) as trend
),

authentication_kpi AS (
    SELECT 
        COALESCE((SELECT ok FROM current_health WHERE service = 'keycloak' LIMIT 1), false) as ok,
        COALESCE(ROUND((SELECT latency_ms FROM current_health WHERE service = 'keycloak' LIMIT 1)::numeric, 2)::float, 0.0) as latency_ms,
        COALESCE((SELECT error FROM current_health WHERE service = 'keycloak' LIMIT 1), 'No data') as error,
        COALESCE(
            (SELECT ARRAY_AGG(
                (at.date, at.value, at.latency, at.count)::types.q_get_logs_bundle_v4_trend_data
                ORDER BY at.date
            ) FROM authentication_trend at),
            '{}'::types.q_get_logs_bundle_v4_trend_data[]
        ) as trend
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
health_kpis_row AS (
    SELECT 
        (
            (SELECT (ok, latency_ms, error, trend)::types.q_get_logs_bundle_v4_health_kpi FROM websocket_kpi LIMIT 1),
            (SELECT (ok, latency_ms, error, trend)::types.q_get_logs_bundle_v4_health_kpi FROM redis_kpi LIMIT 1),
            (SELECT (ok, latency_ms, error, trend)::types.q_get_logs_bundle_v4_health_kpi FROM document_kpi LIMIT 1),
            (SELECT (ok, latency_ms, error, trend)::types.q_get_logs_bundle_v4_health_kpi FROM database_kpi LIMIT 1),
            (SELECT (ok, latency_ms, error, trend)::types.q_get_logs_bundle_v4_health_kpi FROM authentication_kpi LIMIT 1)
        )::types.q_get_logs_bundle_v4_health_kpis as health_kpis
),
actor_profile AS (
    SELECT COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM profiles
    WHERE id = (SELECT profile_id FROM params)
    LIMIT 1
)
SELECT 
    COALESCE((SELECT actor_name FROM actor_profile), 'System')::text as actor_name,
    (SELECT health_kpis FROM health_kpis_row) as health_kpis,
    COALESCE(
        ARRAY_AGG(
            (
                to_char(mt.date_hour, 'YYYY-MM-DD HH24:MI:SS'),
                ROUND(mt.avg_cpu_percent::numeric, 2)::float,
                ROUND(mt.avg_latency_ms::numeric, 2)::float,
                ROUND(mt.avg_memory_bytes::numeric, 0)::bigint,
                mt.max_requests_total,
                mt.max_errors_total,
                mt.sample_count
            )::types.q_get_logs_bundle_v4_metrics_data_point
            ORDER BY mt.date_hour
        ),
        '{}'::types.q_get_logs_bundle_v4_metrics_data_point[]
    ) as metrics
FROM metrics_trend mt
$$;