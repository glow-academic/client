-- Search health entries from health_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_search_health_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_health_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_search_health_entries_v4(
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
            'service', m.service,
            'check_count', m.check_count,
            'ok_count', m.ok_count,
            'fail_count', m.fail_count,
            'uptime_percent', m.uptime_percent,
            'avg_latency_ms', m.avg_latency_ms,
            'min_latency_ms', m.min_latency_ms,
            'max_latency_ms', m.max_latency_ms,
            'latest_ok', m.latest_ok,
            'latest_error', m.latest_error
        ) AS row_data
        FROM health_mv m
        WHERE true

        ORDER BY m.date_hour DESC
        LIMIT limit_count
        OFFSET offset_count
    ) sub;
END;
$$;
