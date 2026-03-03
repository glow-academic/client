-- Get health entries by date_hours from health_mv

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_get_health_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_health_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_get_health_entries_v4(
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
        )
    ) AS items
    FROM health_mv m
    WHERE m.date_hour = ANY(date_hours);
END;
$$;
