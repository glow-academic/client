-- Insert or update app metrics snapshot
INSERT INTO app_metrics (ts, requests_total, errors_total, avg_latency_ms, cpu_percent, memory_bytes)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (ts) DO UPDATE
SET requests_total = EXCLUDED.requests_total,
    errors_total = EXCLUDED.errors_total,
    avg_latency_ms = EXCLUDED.avg_latency_ms,
    cpu_percent = EXCLUDED.cpu_percent,
    memory_bytes = EXCLUDED.memory_bytes

