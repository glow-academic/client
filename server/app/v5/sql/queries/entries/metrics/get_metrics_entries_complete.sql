-- Get metrics entries by date_hours from metrics_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_metrics_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_metrics_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_metrics_entries_v4(
    date_hours timestamptz[]
) RETURNS TABLE(
    items jsonb
)
LANGUAGE plpgsql STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT jsonb_agg(
        jsonb_build_object(
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
        )
    ) AS items
    FROM metrics_mv m
    WHERE m.date_hour = ANY(date_hours);
END;
$$;
