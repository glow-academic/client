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
    (SELECT requests_per_day FROM profile_request_limits WHERE profile_id = p.id AND active = true LIMIT 1) as req_per_day,
    p.last_login,
    (SELECT last_active FROM profile_activity WHERE profile_id = p.id ORDER BY created_at DESC LIMIT 1) as last_active,
    p.created_at,
    p.updated_at,
    (SELECT department_id FROM profile_departments WHERE profile_id = p.id AND is_primary = TRUE LIMIT 1) as primary_department_id
FROM profiles p
WHERE p.id = $1

