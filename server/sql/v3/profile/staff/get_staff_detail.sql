-- Get staff detail with role visibility check and all fields needed for editing
-- Parameters:
--   $1 = profileId (uuid) - target profile to get details for
--   $2 = currentProfileId (uuid or NULL) - current user's profile ID for role visibility check
-- Returns: All fields needed for editing staff
WITH resolve_current_profile_id AS (
    SELECT 
        CASE 
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
        COALESCE(p.first_name || ' ' || p.last_name, '') as name
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
            WHEN cur.role = 'admin' AND tp.role IN ('admin', 'instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'instructional' AND tp.role IN ('instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'member' AND tp.role IN ('member', 'guest') THEN true
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
target_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id::text ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.profile_id = $1 AND cp.active = true AND c.active = true
),
target_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id::text ORDER BY d.title) as department_ids,
        (SELECT department_id::text FROM profile_departments WHERE profile_id = $1 AND is_primary = TRUE AND active = true LIMIT 1) as primary_department_id
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.profile_id = $1 AND pd.active = true AND d.active = true
),
target_primary_department AS (
    SELECT department_id::text
    FROM profile_departments pd
    WHERE pd.profile_id = $1 AND pd.is_primary = TRUE
    LIMIT 1
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohorts c
    WHERE c.active = true
),
cohort_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            c.id::text,
            jsonb_build_object(
                'name', COALESCE(c.title, ''),
                'description', COALESCE(c.description, '')
            )
        ) FILTER (WHERE c.id IS NOT NULL),
        '{}'::jsonb
    ) as cohort_mapping,
    array_agg(c.id::text ORDER BY c.title) FILTER (WHERE c.id IS NOT NULL) as valid_cohort_ids
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', COALESCE(d.title, ''),
                    'description', COALESCE(d.description, '')
                )
            ) FILTER (WHERE d.id IS NOT NULL),
            '{}'::jsonb
        ) as dept_mapping,
        COALESCE(array_agg(d.id::text ORDER BY d.title) FILTER (WHERE d.id IS NOT NULL), ARRAY[]::text[]) as dept_ids
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments d ON d.id = pd.department_id AND d.active = true
    WHERE rpi.resolved_profile_id IS NOT NULL
),
can_edit_check AS (
    SELECT 
        CASE 
            WHEN cur.role = 'superadmin' THEN true
            WHEN cur.role = 'admin' AND vp.role IN ('admin', 'instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'instructional' AND vp.role IN ('instructional', 'member', 'guest') THEN true
            WHEN cur.role = 'member' AND vp.role IN ('member', 'guest') THEN true
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
    COALESCE(tpc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
    COALESCE(tpd.department_ids, ARRAY[]::text[]) as department_ids,
    tpd.primary_department_id as primary_department_id,
    COALESCE(cec.can_edit, false) as can_edit,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(cmd.cohort_mapping, '{}'::jsonb) as cohort_mapping,
    COALESCE(cmd.valid_cohort_ids, ARRAY[]::text[]) as valid_cohort_ids
FROM visible_profile vp
CROSS JOIN valid_depts vd
CROSS JOIN can_edit_check cec
CROSS JOIN cohort_mapping_data cmd
LEFT JOIN target_profile_cohorts tpc ON true
LEFT JOIN target_profile_departments tpd ON true

