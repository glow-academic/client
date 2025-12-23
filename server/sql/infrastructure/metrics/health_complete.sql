-- Insert or update service health check
INSERT INTO service_health (ts, service, ok, latency_ms, error)
VALUES ($1, $2, $3, $4, $5)
ON CONFLICT (ts, service) DO UPDATE
SET ok = EXCLUDED.ok,
    latency_ms = EXCLUDED.latency_ms,
    error = EXCLUDED.error

