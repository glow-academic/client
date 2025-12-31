-- Insert or update service health check
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then recreate

BEGIN;

-- Drop function if exists (handle signature changes)
DO $$ 
BEGIN
    DROP FUNCTION IF EXISTS infra_health_metrics_v3(timestamptz, text, boolean, double precision, text);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create function
CREATE OR REPLACE FUNCTION infra_health_metrics_v3(
    ts timestamptz,
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
    INSERT INTO service_health (ts, service, ok, latency_ms, error)
    VALUES (ts, service, ok, latency_ms, error)
    ON CONFLICT (ts, service) DO UPDATE
    SET ok = EXCLUDED.ok,
        latency_ms = EXCLUDED.latency_ms,
        error = EXCLUDED.error;
    SELECT true as success;
$$;

COMMIT;

