-- Get recent app logs filtered by level
-- Params: $1 = level, $2 = limit
SELECT 
    id,
    level,
    message,
    context,
    created_at
FROM app_logs
WHERE ($1 = 'all' OR level = $1)
ORDER BY created_at DESC
LIMIT $2;

