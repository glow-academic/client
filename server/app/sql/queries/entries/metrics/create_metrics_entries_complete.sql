-- Create metrics entry with strongly-typed params

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_create_metrics_entry_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_metrics_entry_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.api_create_metrics_entry_v4(
    session_id uuid,
    ts timestamptz,
    requests_total bigint,
    errors_total bigint,
    avg_latency_ms double precision,
    cpu_percent double precision,
    memory_bytes bigint,
    mcp boolean DEFAULT false
) RETURNS TABLE (out_ts text)
LANGUAGE plpgsql AS $$
DECLARE v_ts text;
BEGIN
    INSERT INTO metrics_entry (session_id, ts, requests_total, errors_total, avg_latency_ms, cpu_percent, memory_bytes, mcp)
    VALUES (api_create_metrics_entry_v4.session_id, api_create_metrics_entry_v4.ts, api_create_metrics_entry_v4.requests_total, api_create_metrics_entry_v4.errors_total, api_create_metrics_entry_v4.avg_latency_ms, api_create_metrics_entry_v4.cpu_percent, api_create_metrics_entry_v4.memory_bytes, api_create_metrics_entry_v4.mcp)
    RETURNING metrics_entry.ts::text INTO v_ts;
    RETURN QUERY SELECT v_ts;
END; $$;
