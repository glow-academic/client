-- Insert or update service health check
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate
-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_health_metrics_v4(timestamptz, text, boolean, double precision, text);
    DROP FUNCTION IF EXISTS infra_health_metrics_v4(text, text, boolean, double precision, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
-- Accept ts as text (ISO format string) and cast to timestamptz internally
-- This allows Python to pass ISO strings which Pydantic validates, and SQL handles conversion
CREATE OR REPLACE FUNCTION infra_health_metrics_v4(
    ts text,
    service text,
    ok boolean,
    latency_ms double precision,
    error text
)
RETURNS TABLE (
    success boolean
)
LANGUAGE sql
VOLATILE
AS $$
    INSERT INTO health (ts, service, ok, latency_ms, error)
    VALUES (ts::timestamptz, service, ok, latency_ms, error)
    ON CONFLICT (ts, service) DO UPDATE
    SET ok = EXCLUDED.ok,
        latency_ms = EXCLUDED.latency_ms,
        error = EXCLUDED.error;
    SELECT true as success;
$$;