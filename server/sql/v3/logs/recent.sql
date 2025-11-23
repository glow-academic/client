-- Get recent app logs filtered by level
-- Params: $1 = level, $2 = limit
SELECT 
    id,
    level,
    logger_name,
    message,
    extra,
    ts as created_at
FROM app_logs
WHERE ($1 = 'all' OR level = $1)
ORDER BY ts DESC
LIMIT $2;
