-- Get logs list with profile join (using direct profile_id column)
SELECT 
    al.id::text as log_id,
    al.level,
    al.logger_name,
    al.message,
    al.profile_id::text,
    al.extra,
    al.ts as created_at,
    COALESCE(
        p.first_name || ' ' || p.last_name,
        'System'
    ) as actor_name
FROM app_logs al
LEFT JOIN profiles p ON p.id = al.profile_id
ORDER BY al.ts DESC
LIMIT 1000
