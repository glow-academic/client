-- Insert or update app metrics snapshot
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_snapshot_metrics_v4(timestamptz, integer, integer, double precision, double precision, bigint);
    DROP FUNCTION IF EXISTS infra_snapshot_metrics_v4(text, integer, integer, double precision, double precision, bigint);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
-- Accept ts as text (ISO format string) and cast to timestamptz internally
-- This allows Python to pass ISO strings which Pydantic validates, and SQL handles conversion
CREATE OR REPLACE FUNCTION infra_snapshot_metrics_v4(
    ts text,
    requests_total integer,
    errors_total integer,
    avg_latency_ms double precision,
    cpu_percent double precision,
    memory_bytes bigint
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO app_metrics (ts, requests_total, errors_total, avg_latency_ms, cpu_percent, memory_bytes)
    VALUES (ts::timestamptz, requests_total, errors_total, avg_latency_ms, cpu_percent, memory_bytes)
    ON CONFLICT (ts) DO UPDATE
    SET requests_total = EXCLUDED.requests_total,
        errors_total = EXCLUDED.errors_total,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        cpu_percent = EXCLUDED.cpu_percent,
        memory_bytes = EXCLUDED.memory_bytes;
    SELECT true as success;
$$;

COMMIT;

