-- Get health_entry list with pagination
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_health_list_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_health_list_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_health_list_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_health_list_v4_metric AS (
    date text,
    cpu_percent float,
    latency_ms float,
    memory_bytes bigint,
    requests_total int,
    errors_total int,
    sample_count int
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_health_list_v4(
    profile_id uuid DEFAULT NULL,
    page integer DEFAULT 0,
    page_size integer DEFAULT 50
)
RETURNS TABLE (
    actor_name text,
    metrics_entry types.q_get_health_list_v4_metric[],
    total_count bigint,
    page integer,
    page_size integer,
    total_pages integer
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        page AS page,
        page_size AS page_size,
        (page * page_size) AS offset_value
),
user_profile AS (
    SELECT 
        COALESCE(
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id LIMIT 1) || ' ' || 
            (SELECT n2.name FROM profile_names_junction pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile_artifact.id LIMIT 1), 
            'System'
        ) as actor_name
    FROM params x
    LEFT JOIN profile_artifact ON profile_artifact.id = x.profile_id
    LIMIT 1
),
-- App metrics_entry time series (last 7 days, aggregated by hour)
metrics_trend AS (
    SELECT 
        date_trunc('hour', ts) as date_hour,
        AVG(cpu_percent) as avg_cpu_percent,
        AVG(avg_latency_ms) as avg_latency_ms,
        AVG(memory_bytes) as avg_memory_bytes,
        MAX(requests_total) as max_requests_total,
        MAX(errors_total) as max_errors_total,
        COUNT(*) as sample_count
    FROM metrics_entry
    WHERE ts >= NOW() - INTERVAL '7 days'
    GROUP BY date_hour
    ORDER BY date_hour DESC
),
metric_count AS (
    SELECT COUNT(*) as total_count
    FROM metrics_trend
),
paginated_metrics AS (
    SELECT 
        to_char(mt.date_hour, 'YYYY-MM-DD HH24:MI:SS') as date,
        ROUND(mt.avg_cpu_percent::numeric, 2)::float as cpu_percent,
        ROUND(mt.avg_latency_ms::numeric, 2)::float as latency_ms,
        ROUND(mt.avg_memory_bytes::numeric, 0)::bigint as memory_bytes,
        mt.max_requests_total as requests_total,
        mt.max_errors_total as errors_total,
        mt.sample_count
    FROM metrics_trend mt
    ORDER BY mt.date_hour DESC
    LIMIT (SELECT page_size FROM params)
    OFFSET (SELECT offset_value FROM params)
)
SELECT 
    COALESCE((SELECT actor_name FROM user_profile), 'System')::text as actor_name,
    COALESCE(
        ARRAY_AGG(
            (pm.date, pm.cpu_percent, pm.latency_ms, pm.memory_bytes, pm.requests_total, pm.errors_total, pm.sample_count)::types.q_get_health_list_v4_metric
            ORDER BY pm.date DESC
        ),
        '{}'::types.q_get_health_list_v4_metric[]
    ) as metrics_entry,
    COALESCE((SELECT total_count FROM metric_count), 0)::bigint as total_count,
    (SELECT page FROM params)::integer as page,
    (SELECT page_size FROM params)::integer as page_size,
    CASE 
        WHEN (SELECT page_size FROM params) > 0 
        THEN ((COALESCE((SELECT total_count FROM metric_count), 0) + (SELECT page_size FROM params) - 1) / (SELECT page_size FROM params))::integer
        ELSE 0::integer
    END as total_pages
FROM paginated_metrics pm
$$;
