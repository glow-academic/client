SELECT 
    al.id::text as log_id,
    al.event,
    al.level,
    al.message,
    al.correlation_id,
    al.actor,
    al.subject,
    al.context,
    al.error,
    al.created_at,
    COALESCE(
        p.first_name || ' ' || p.last_name,
        (al.actor->>'profileId')::text,
        'System'
    ) as actor_name
FROM app_logs al
LEFT JOIN profiles p ON p.id::text = (al.actor->>'profileId')::text
ORDER BY al.created_at DESC
LIMIT 1000

