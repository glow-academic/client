-- Get staff detail with role visibility check
-- Parameters:
--   $1 = profileId (uuid) - target profile to get details for
--   $2 = currentProfileId (uuid) - current user's profile ID for role visibility check
--   $3 = campus_domain (text) - campus email domain
-- Returns: name, email, role (only if visible to current user based on role hierarchy)
WITH current_user_role AS (
    SELECT role FROM profiles WHERE id = $2
),
target_profile AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.alias,
        p.role,
        p.first_name || ' ' || p.last_name as name,
        p.alias || '@' || $3 as email
    FROM profiles p
    WHERE p.id = $1
),
role_visibility_check AS (
    -- Check if current user can see target profile based on role hierarchy
    SELECT 
        tp.*,
        CASE 
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND tp.role IN ('admin', 'instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'instructional' AND tp.role IN ('instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'ta' AND tp.role IN ('ta', 'guest') THEN true
            WHEN cur.role = 'guest' AND tp.role = 'guest' THEN true
            ELSE false
        END as can_see
    FROM target_profile tp
    CROSS JOIN current_user_role cur
)
SELECT 
    name,
    email,
    role
FROM role_visibility_check
WHERE can_see = true

