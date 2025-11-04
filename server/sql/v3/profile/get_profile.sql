SELECT 
    p.id,
    p.first_name,
    p.last_name,
    p.alias,
    p.role,
    p.active,
    p.viewed_intro,
    p.viewed_chat,
    p.default_profile,
    prl.requests_per_day as req_per_day,
    p.last_login,
    pa.last_active,
    p.created_at,
    p.updated_at,
    pd.department_id as primary_department_id
FROM profiles p
LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
LEFT JOIN LATERAL (
    SELECT last_active 
    FROM profile_activity 
    WHERE profile_id = p.id 
    ORDER BY created_at DESC 
    LIMIT 1
) pa ON true
WHERE p.id = $1

