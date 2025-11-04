WITH requester_role AS (
    SELECT role
    FROM profiles
    WHERE id = $1
)
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
    COALESCE(prl.requests_per_day, 0) as req_per_day,
    p.last_login,
    pa.last_active,
    p.created_at,
    p.updated_at,
    pd.department_id as primary_department_id
FROM profiles p
CROSS JOIN requester_role rr
LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
LEFT JOIN LATERAL (
    SELECT last_active 
    FROM profile_activity 
    WHERE profile_id = p.id 
    ORDER BY created_at DESC 
    LIMIT 1
) pa ON true
WHERE p.id != $1
  AND CASE 
    WHEN rr.role = 'superadmin' THEN true
    WHEN rr.role = 'admin' THEN p.role IN ('instructional', 'ta', 'guest')
    WHEN rr.role = 'instructional' THEN p.role IN ('ta', 'guest')
    ELSE false
  END
ORDER BY p.first_name, p.last_name

