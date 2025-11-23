-- Get logs list with profile join (using app_logs_profiles junction table)
SELECT 
    al.id::text as log_id,
    al.level,
    al.logger_name,
    al.message,
    alp.profile_id::text,
    al.extra,
    al.ts as created_at,
    COALESCE(
        p.first_name || ' ' || p.last_name,
        'System'
    ) as actor_name
FROM app_logs al
LEFT JOIN app_logs_profiles alp ON alp.app_log_id = al.id
LEFT JOIN profiles p ON p.id = alp.profile_id
ORDER BY al.ts DESC
LIMIT 1000
