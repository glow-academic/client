-- Search metrics entries from metrics_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_metrics_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_metrics_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_metrics_entries_v4(
    search text DEFAULT NULL,
    limit_count integer DEFAULT 20,
    offset_count integer DEFAULT 0

) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(row_data) AS items
    FROM (
        SELECT jsonb_build_object(
            'date_hour', m.date_hour,
            'sample_count', m.sample_count,
            'avg_cpu_percent', m.avg_cpu_percent,
            'min_cpu_percent', m.min_cpu_percent,
            'max_cpu_percent', m.max_cpu_percent,
            'avg_latency_ms', m.avg_latency_ms,
            'min_latency_ms', m.min_latency_ms,
            'max_latency_ms', m.max_latency_ms,
            'avg_memory_bytes', m.avg_memory_bytes,
            'min_memory_bytes', m.min_memory_bytes,
            'max_memory_bytes', m.max_memory_bytes,
            'max_requests_total', m.max_requests_total,
            'max_errors_total', m.max_errors_total
        ) AS row_data
        FROM metrics_mv m
        WHERE true

        ORDER BY m.date_hour DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
