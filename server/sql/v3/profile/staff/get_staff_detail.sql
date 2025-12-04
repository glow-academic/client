-- Get staff detail with role visibility check and all fields needed for editing
-- Parameters:
--   $1 = profileId (uuid) - target profile to get details for
--   $2 = currentProfileId (uuid) - current user's profile ID for role visibility check
-- Returns: All fields needed for editing staff
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (default settings only)
    SELECT 
        sdg.profile_id as guest_profile_id
    FROM settings_default_guest sdg
    JOIN settings s ON s.id = sdg.settings_id AND s.active = true
    WHERE sdg.active = true
    LIMIT 1
),
resolve_current_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
current_user_role AS (
    SELECT role FROM resolve_current_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
target_profile AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        prl.requests_per_day,
        p.first_name || ' ' || p.last_name as name
    FROM profiles p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = $1
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, prl.requests_per_day
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
),
visible_profile AS (
    SELECT * FROM role_visibility_check WHERE can_see = true
),
current_user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_current_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
),
target_primary_department AS (
    SELECT department_id::text
    FROM profile_departments pd
    WHERE pd.profile_id = $1 AND pd.is_primary = TRUE
    LIMIT 1
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        COALESCE(array_agg(d.id::text ORDER BY d.title), ARRAY[]::text[]) as dept_ids
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments d ON d.id = pd.department_id AND d.active = true
    WHERE rpi.resolved_profile_id IS NOT NULL
),
can_edit_check AS (
    SELECT 
        CASE 
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND vp.role IN ('admin', 'instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'instructional' AND vp.role IN ('instructional', 'ta', 'guest') THEN true
            WHEN cur.role = 'ta' AND vp.role IN ('ta', 'guest') THEN true
            ELSE false
        END as can_edit
    FROM visible_profile vp
    CROSS JOIN current_user_role cur
)
SELECT 
    vp.id::text as profile_id,
    vp.first_name,
    vp.last_name,
    vp.name,
    COALESCE(vp.emails, ARRAY[]::text[]) as emails,
    vp.primary_email,
    vp.role,
    vp.active,
    vp.requests_per_day,
    tpd.department_id as primary_department_id,
    COALESCE(cec.can_edit, false) as can_edit,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vd.dept_mapping, '{}'::jsonb) as department_mapping
FROM visible_profile vp
CROSS JOIN valid_depts vd
CROSS JOIN can_edit_check cec
LEFT JOIN target_primary_department tpd ON true

