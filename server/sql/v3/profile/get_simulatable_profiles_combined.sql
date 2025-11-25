WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            ELSE $1::uuid
        END as resolved_profile_id
),
requester_role AS (
    SELECT role
    FROM profiles p, resolve_profile_id rpi
    WHERE p.id = rpi.resolved_profile_id
)
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
    (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
    p.role,
    p.active,
    p.default_profile,
    COALESCE(prl.requests_per_day, 0) as req_per_day,
    p.last_login,
    pa.last_active,
    p.created_at,
    p.updated_at,
    pd.department_id as primary_department_id
FROM profiles p
CROSS JOIN requester_role rr
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
LEFT JOIN profile_departments pd ON p.id = pd.profile_id AND pd.is_primary = TRUE
LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
LEFT JOIN LATERAL (
    SELECT last_active 
    FROM profile_activity 
    WHERE profile_id = p.id 
    ORDER BY created_at DESC 
    LIMIT 1
) pa ON true
WHERE p.id != (SELECT resolved_profile_id FROM resolve_profile_id)
  AND CASE 
    WHEN rr.role = 'superadmin' THEN true
    WHEN rr.role = 'admin' THEN p.role IN ('instructional', 'ta', 'guest')
    WHEN rr.role = 'instructional' THEN p.role IN ('ta', 'guest')
    ELSE false
  END
GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
         p.default_profile, prl.requests_per_day, p.last_login, pa.last_active, 
         p.created_at, p.updated_at, pd.department_id
ORDER BY p.first_name, p.last_name

