WITH cohort_data AS (
    SELECT id, title, description, active
    FROM cohorts
    WHERE id = $1
),
current_cohort_profiles AS (
    SELECT cp.profile_id
    FROM cohort_profiles cp
    WHERE cp.cohort_id = $1 AND cp.active = true
),
profile_cohorts AS (
    SELECT 
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
recent_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as run_count
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY mrp.profile_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $3
),
all_staff AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.first_name || ' ' || p.last_name as name,
        p.role,
        SUBSTRING(p.first_name FROM 1 FOR 1) || SUBSTRING(p.last_name FROM 1 FOR 1) as initials,
        p.active,
        pa.last_active as lastActive,
        prl.requests_per_day as requests_per_day,
        p.default_profile,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day,
        COALESCE(pc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND p.role != 'superadmin' THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN up.role = 'superadmin' AND p.default_profile = false THEN true
            ELSE false
        END as can_delete
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profile_id = p.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN LATERAL (
        SELECT last_active 
        FROM profile_activity 
        WHERE profile_id = p.id 
        ORDER BY created_at DESC 
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile up
    WHERE pd.department_id = ANY($2)
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, p.default_profile,
             pa.last_active, prl.requests_per_day, pc.cohort_ids, rr.run_count, up.role
    ORDER BY p.id, p.last_name, p.first_name
),
available_profiles AS (
    SELECT *
    FROM all_staff
    WHERE profile_id NOT IN (SELECT profile_id FROM current_cohort_profiles)
        AND default_profile = false
        AND role IN ('instructional', 'ta')
)
SELECT
    cd.id::text as cohort_id,
    cd.title,
    cd.description,
    cd.active,
    (SELECT COALESCE(array_agg(profile_id::text), ARRAY[]::text[])
     FROM current_cohort_profiles) as current_profile_ids,
    (SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'profile_id', ap.profile_id::text,
            'first_name', ap.first_name,
            'last_name', ap.last_name,
            'emails', COALESCE(ap.emails, ARRAY[]::text[]),
            'primaryEmail', ap.primary_email,
            'name', ap.name,
            'role', ap.role,
            'initials', ap.initials,
            'active', ap.active,
            'lastActive', ap.lastActive,
            'cohort_ids', COALESCE((
                SELECT array_agg(cid::text)
                FROM unnest(ap.cohort_ids) as cid
            ), ARRAY[]::text[]),
            'requests_per_day', ap.requests_per_day,
            'default_profile', ap.default_profile,
            'requests_in_last_day', ap.requests_in_last_day,
            'can_edit', ap.can_edit,
            'can_delete', ap.can_delete
        ) ORDER BY ap.last_name, ap.first_name
     ), '[]'::jsonb)
     FROM available_profiles ap
    ) as available_profiles,
    (SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', d.description
        )
     ), '{}'::jsonb)
     FROM departments d
     WHERE d.id = ANY($2)
    ) as department_mapping
FROM cohort_data cd

