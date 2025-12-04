WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
profile_active_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as active_cohort_count
    FROM cohort_profiles
    WHERE active = true
    GROUP BY profile_id
),
profile_all_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as total_cohort_links
    FROM cohort_profiles
    GROUP BY profile_id
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
profile_departments_agg AS (
    SELECT 
        pd.profile_id,
        ARRAY_AGG(pd.department_id ORDER BY d.title) as department_ids
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
profile_primary_department AS (
    SELECT 
        pd.profile_id,
        pd.department_id
    FROM profile_departments pd
    WHERE pd.active = true AND pd.is_primary = true
),
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY d.title) as valid_department_ids
    FROM departments d
    WHERE d.active = true
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
profile_total_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as total_requests
    FROM run_profiles mrp
    GROUP BY mrp.profile_id
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM profile_cohorts
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM profile_departments_agg
),
cohort_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        c.id::text,
        jsonb_build_object(
            'name', c.title,
            'description', COALESCE(c.description, '')
        )
    ), '{}'::jsonb) as cohort_mapping
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id::uuid FROM all_cohort_ids)
),
department_mapping_data AS (
    SELECT COALESCE(jsonb_object_agg(
        d.id::text,
        jsonb_build_object(
            'name', d.title,
            'description', COALESCE(d.description, '')
        )
    ), '{}'::jsonb) as department_mapping
    FROM departments d
    WHERE (d.id IN (SELECT department_id FROM user_departments) OR d.id IN (SELECT department_id FROM all_department_ids))
    AND d.active = true
),
-- Trend data CTEs
active_users_count AS (
    SELECT COUNT(DISTINCT p.id) as count
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND p.active = true
),
admin_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND p.role IN ('admin', 'superadmin')
    GROUP BY DATE(p.created_at)
),
admin_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM admin_users_by_date
),
admin_users_trend AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date::text,
            'value', cumulative_count::float,
            'count', daily_count
        ) ORDER BY date
    ), '[]'::jsonb) as trend
    FROM admin_users_cumulative
),
instructional_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND p.role = 'instructional'
    GROUP BY DATE(p.created_at)
),
instructional_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM instructional_users_by_date
),
instructional_users_trend AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date::text,
            'value', cumulative_count::float,
            'count', daily_count
        ) ORDER BY date
    ), '[]'::jsonb) as trend
    FROM instructional_users_cumulative
),
ta_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND p.role = 'ta'
    GROUP BY DATE(p.created_at)
),
ta_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM ta_users_by_date
),
ta_users_trend AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date::text,
            'value', cumulative_count::float,
            'count', daily_count
        ) ORDER BY date
    ), '[]'::jsonb) as trend
    FROM ta_users_cumulative
),
total_requests_by_date AS (
    SELECT 
        DATE(mr.created_at) as date,
        COUNT(*) as count
    FROM runs mr
    JOIN run_profiles mrp ON mrp.run_id = mr.id
    JOIN profile_departments pd ON pd.profile_id = mrp.profile_id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY DATE(mr.created_at)
),
total_requests_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM total_requests_by_date
),
total_requests_trend AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date::text,
            'value', cumulative_count::float,
            'count', daily_count
        ) ORDER BY date
    ), '[]'::jsonb) as trend
    FROM total_requests_cumulative
),
-- Active users trend: constant line (straight horizontal)
earliest_date AS (
    SELECT MIN(DATE(p.created_at)) as date
    FROM profiles p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
active_users_trend AS (
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date::text,
            'value', auc.count::float,
            'count', 0
        ) ORDER BY date
    ), '[]'::jsonb) as trend
    FROM (
        SELECT 
            COALESCE((SELECT date FROM earliest_date), CURRENT_DATE) as date,
            (SELECT count FROM active_users_count) as count
        UNION ALL
        SELECT CURRENT_DATE as date, (SELECT count FROM active_users_count) as count
    ) auc
),
trend_data_combined AS (
    SELECT jsonb_build_object(
        'active', (SELECT trend FROM active_users_trend),
        'admin', (SELECT trend FROM admin_users_trend),
        'instructional', (SELECT trend FROM instructional_users_trend),
        'ta', (SELECT trend FROM ta_users_trend),
        'total_requests', (SELECT trend FROM total_requests_trend)
    ) as trend_data
)
SELECT DISTINCT ON (p.id)
    p.id as profile_id,
    p.first_name,
    p.last_name,
    COALESCE(
        ARRAY(
            SELECT email FROM (
                SELECT DISTINCT ON (pe2.email) 
                    pe2.email,
                    pe2.is_primary,
                    pe2.created_at
                FROM profile_emails pe2 
                WHERE pe2.profile_id = p.id AND pe2.active = true 
                ORDER BY pe2.email, pe2.is_primary DESC, pe2.created_at
            ) distinct_emails
            ORDER BY is_primary DESC, created_at
        ),
        ARRAY[]::text[]
    ) as emails,
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
    COALESCE(
        ARRAY(SELECT unnest(pda.department_ids)::text),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(ppd.department_id::text, '') as primary_department_id,
    COALESCE(ptr.total_requests, 0) as total_requests,
    COALESCE(pacl.active_cohort_count, 0) as active_cohort_count,
    COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
    CASE 
        -- Always allow editing self
        WHEN p.id = $1 THEN true
        -- Superadmin has no restrictions
        WHEN up.role = 'superadmin' THEN true
        -- Cannot edit default_profile unless superadmin
        WHEN (p.first_name = 'Default') THEN false
        -- Role hierarchy: can only edit roles lower than current role
        WHEN up.role = 'admin' AND p.role IN ('instructional', 'ta', 'guest') THEN true
        WHEN up.role = 'instructional' AND p.role IN ('ta', 'guest') THEN true
        WHEN up.role = 'ta' AND p.role = 'guest' THEN true
        ELSE false
    END as can_edit,
    CASE 
        -- Cannot delete ourselves
        WHEN p.id = $1 THEN false
        -- Superadmin has no restrictions (except self)
        WHEN up.role = 'superadmin' THEN true
        -- Cannot delete default_profile unless superadmin
        WHEN (p.first_name = 'Default') THEN false
        -- Cannot delete profiles with cohort links (prevent orphaned data)
        WHEN COALESCE(pacl_all.total_cohort_links, 0) > 0 THEN false
        -- Role hierarchy: can only delete roles lower than current role
        WHEN up.role = 'admin' AND p.role IN ('instructional', 'ta', 'guest') THEN true
        WHEN up.role = 'instructional' AND p.role IN ('ta', 'guest') THEN true
        WHEN up.role = 'ta' AND p.role = 'guest' THEN true
        ELSE false
    END as can_delete,
    cmd.cohort_mapping,
    dmd.department_mapping,
    tdc.trend_data,
    up.role as current_user_role,
    COALESCE(vdid.valid_department_ids, ARRAY[]::text[]) as valid_department_ids
FROM profiles p
LEFT JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
LEFT JOIN profile_active_cohort_links pacl ON pacl.profile_id = p.id
LEFT JOIN profile_all_cohort_links pacl_all ON pacl_all.profile_id = p.id
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
CROSS JOIN cohort_mapping_data cmd
CROSS JOIN department_mapping_data dmd
CROSS JOIN trend_data_combined tdc
CROSS JOIN valid_department_ids_data vdid
WHERE (
    -- Superadmins see all profiles (bypass department filter)
    up.role = 'superadmin' 
    -- Non-superadmins only see profiles that share departments with them
    OR pd.department_id IN (SELECT department_id FROM user_departments)
)
AND (
    up.role = 'superadmin' OR
    (up.role = 'admin' AND p.role IN ('admin', 'instructional', 'ta', 'guest')) OR
    (up.role = 'instructional' AND p.role IN ('instructional', 'ta', 'guest')) OR
    (up.role = 'ta' AND p.role IN ('ta', 'guest')) OR
    (up.role = 'guest' AND p.role = 'guest')
)
GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, p.default_profile, 
         pa.last_active, prl.requests_per_day,
         pc.cohort_ids, pda.department_ids, ppd.department_id, ptr.total_requests,
         pacl.active_cohort_count, pacl_all.total_cohort_links, rr.run_count,
         cmd.cohort_mapping, dmd.department_mapping, tdc.trend_data, up.role,
         vdid.valid_department_ids
ORDER BY p.id, p.last_name, p.first_name

