-- Get profile by ID
-- Parameters: $1=profileId (uuid)
-- Returns: Profile data or no rows if profile doesn't exist
SELECT 
    p.id,
    p.first_name,
    p.last_name,
    ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
    (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
    p.role,
    p.active,
    prl.requests_per_day as req_per_day,
    p.last_login,
    pa.last_active,
    p.created_at,
    p.updated_at,
    pd.department_id as primary_department_id
FROM profiles p
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
WHERE p.id = $1::uuid
GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, 
         prl.requests_per_day, p.last_login, pa.last_active, 
         p.created_at, p.updated_at, pd.department_id

