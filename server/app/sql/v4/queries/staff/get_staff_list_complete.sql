-- Get staff list with permissions and relationships
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_list_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_staff_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_list_staff_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_staff_v4_staff AS (
    profile_id uuid,
    emails text[],
    primary_email text,
    name text,
    role text,
    initials text,
    active boolean,
    last_active timestamptz,
    cohort_ids text[],
    department_ids text[],
    primary_department_id text,
    requests_per_day integer,
    total_requests bigint,
    requests_in_last_day integer,
    can_edit boolean,
    can_delete boolean
);

CREATE TYPE types.q_list_staff_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_staff_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_staff_v4_trend_data AS (
    date date,
    value double precision,
    count integer
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_staff_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    current_user_role text,
    staff types.q_list_staff_v4_staff[],
    cohorts types.q_list_staff_v4_cohort[],
    departments types.q_list_staff_v4_department[],
    trend_data_active types.q_list_staff_v4_trend_data[],
    trend_data_admin types.q_list_staff_v4_trend_data[],
    trend_data_instructional types.q_list_staff_v4_trend_data[],
    trend_data_member types.q_list_staff_v4_trend_data[],
    trend_data_total_requests types.q_list_staff_v4_trend_data[],
    valid_department_ids text[],
    role_options text[],
    cohort_options text[],
    last_active_options text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
profile_active_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as active_cohort_count
    FROM profile_cohorts_junction
    WHERE active = true
    GROUP BY profile_id
),
profile_all_cohort_links AS (
    SELECT 
        profile_id,
        COUNT(*) as total_cohort_links
    FROM profile_cohorts_junction
    GROUP BY profile_id
),
profile_cohorts_junction AS (
    SELECT 
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id::text ORDER BY (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM profile_cohorts_junction cp
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
profile_departments_agg AS (
    SELECT 
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1)) as department_ids
    FROM profile_departments_junction pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
profile_primary_department AS (
    SELECT 
        pd.profile_id,
        pd.department_id::text as department_id
    FROM profile_departments_junction pd
    WHERE pd.active = true AND pd.is_primary = true
),
valid_department_ids_data AS (
    SELECT array_agg(d.id::text ORDER BY (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as valid_department_ids
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
),
recent_runs AS (
    SELECT
        prj.profile_id,
        COUNT(*) as run_count
    FROM profile_runs_junction prj
    JOIN runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY prj.profile_id
),
profile_total_runs AS (
    SELECT
        prj.profile_id,
        COUNT(*) as total_requests
    FROM profile_runs_junction prj
    JOIN runs_entry mr ON mr.id = prj.run_id
    GROUP BY prj.profile_id
),
user_profile AS (
    SELECT role, COALESCE(NULLIF(actor_name, ''), 'System') as actor_name
    FROM view_user_profile_context
    WHERE profile_id = (SELECT profile_id FROM params)
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM profile_cohorts_junction
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM profile_departments_agg
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names_junction cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions_junction cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description
    FROM departments_resource d
    WHERE (d.id IN (SELECT department_id FROM user_departments) OR d.id IN (SELECT department_id FROM all_department_ids))
),
-- Trend data CTEs
active_users_count AS (
    SELECT COUNT(DISTINCT p.id) as count
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = true)
),
admin_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('admin'::profile_type, 'superadmin'::profile_type)
    GROUP BY DATE(p.created_at)
),
admin_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM admin_users_by_date
),
instructional_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND EXISTS (SELECT 1 FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'instructional'::profile_type)
    GROUP BY DATE(p.created_at)
),
instructional_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM instructional_users_by_date
),
member_users_by_date AS (
    SELECT 
        DATE(p.created_at) as date,
        COUNT(DISTINCT p.id) as count
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND EXISTS (SELECT 1 FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'member'::profile_type)
    GROUP BY DATE(p.created_at)
),
member_users_cumulative AS (
    SELECT 
        date,
        SUM(count) OVER (ORDER BY date) as cumulative_count,
        count as daily_count
    FROM member_users_by_date
),
total_requests_by_date AS (
    SELECT
        DATE(mr.created_at) as date,
        COUNT(*) as count
    FROM profile_runs_junction prj
    JOIN runs_entry mr ON mr.id = prj.run_id
    JOIN profile_departments_junction pd ON pd.profile_id = prj.profile_id AND pd.active = true
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
earliest_date AS (
    SELECT MIN(DATE(p.created_at)) as date
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
staff_rows AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        COALESCE(
            ARRAY(
                SELECT email FROM (
                    SELECT DISTINCT ON (e2.email) 
                        e2.email,
                        pe2.is_primary,
                        pe2.created_at
                    FROM profile_emails_junction pe2
                    JOIN emails_resource e2 ON pe2.email_id = e2.id
                    WHERE pe2.profile_id = p.id AND pe2.active = true 
                    ORDER BY e2.email, pe2.is_primary DESC, pe2.created_at
                ) distinct_emails
                ORDER BY is_primary DESC, created_at
            ),
            ARRAY[]::text[]
        ) as emails,
        (SELECT e2.email FROM profile_emails_junction pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as name,
        (SELECT r.role FROM profile_roles_junction pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE(SUBSTRING((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) FROM 1 FOR 1), '') ||
        COALESCE(NULLIF(SUBSTRING(SPLIT_PART((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ' ', 2) FROM 1 FOR 1), ''), '') as initials,
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE) as active,
        pa.last_active,
        rl.requests_per_day,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day,
        COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        COALESCE(
            ARRAY(SELECT unnest(pda.department_ids)::text),
            ARRAY[]::text[]
        ) as department_ids,
        COALESCE(ppd.department_id, '') as primary_department_id,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(pacl.active_cohort_count, 0) as active_cohort_count,
        COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
        up.role as current_user_role_for_permissions
    FROM profile_artifact p
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_emails_junction pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_cohorts_junction pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
    LEFT JOIN profile_active_cohort_links pacl ON pacl.profile_id = p.id
    LEFT JOIN profile_all_cohort_links pacl_all ON pacl_all.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profile_id = p.id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT ae.last_active
        FROM profile_activity_junction pactj
        JOIN activity_entry ae ON ae.id = pactj.activity_id
        WHERE pactj.profile_id = p.id
        ORDER BY ae.created_at DESC
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile up
    WHERE (
        -- Superadmins see all profiles (bypass department filter)
        up.role = 'superadmin'::profile_type 
        -- Non-superadmins only see profiles that share departments with them
        OR pd.department_id IN (SELECT department_id FROM user_departments)
    )
    AND (
        up.role = 'superadmin'::profile_type OR
        (up.role = 'admin'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('admin'::profile_type, 'instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type, 'custom'::profile_type)) OR
        (up.role = 'instructional'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type)) OR
        (up.role = 'member'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('member'::profile_type, 'guest'::profile_type)) OR
        (up.role = 'guest' AND EXISTS (SELECT 1 FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'guest'::profile_type))
    )
    GROUP BY p.id, (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE), 
             pa.last_active, rl.requests_per_day,
             pc.cohort_ids, pda.department_ids, ppd.department_id, ptr.total_requests,
             pacl.active_cohort_count, pacl_all.total_cohort_links, rr.run_count, up.role
    ORDER BY p.id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
)
SELECT 
    up.actor_name::text as actor_name,
    up.role::text as current_user_role,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.emails, sr.primary_email, sr.name, sr.role, sr.initials, sr.active, sr.last_active, sr.cohort_ids, sr.department_ids, sr.primary_department_id, sr.requests_per_day, sr.total_requests, sr.requests_in_last_day,
             CASE 
                 -- Always allow editing self
                 WHEN sr.profile_id = (SELECT profile_id FROM params) THEN true
                 -- Superadmin has no restrictions
                 WHEN sr.current_user_role_for_permissions = 'superadmin' THEN true
                 -- Role hierarchy: can only edit roles lower than current role
                 WHEN sr.current_user_role_for_permissions = 'admin' AND sr.role IN ('instructional', 'member', 'guest', 'custom') THEN true
                 WHEN sr.current_user_role_for_permissions = 'instructional' AND sr.role IN ('member', 'guest') THEN true
                 WHEN sr.current_user_role_for_permissions = 'member' AND sr.role = 'guest' THEN true
                 ELSE false
             END,
             CASE 
                 -- Cannot delete ourselves
                 WHEN sr.profile_id = (SELECT profile_id FROM params) THEN false
                 -- Superadmin has no restrictions (except self)
                 WHEN sr.current_user_role_for_permissions = 'superadmin' THEN true
                 -- Cannot delete profiles with cohort links (prevent orphaned data)
                 WHEN sr.total_cohort_links > 0 THEN false
                 -- Role hierarchy: can only delete roles lower than current role
                 WHEN sr.current_user_role_for_permissions = 'admin' AND sr.role IN ('instructional', 'member', 'guest', 'custom') THEN true
                 WHEN sr.current_user_role_for_permissions = 'instructional' AND sr.role IN ('member', 'guest') THEN true
                 WHEN sr.current_user_role_for_permissions = 'member' AND sr.role = 'guest' THEN true
                 ELSE false
             END
            )::types.q_list_staff_v4_staff
            ORDER BY sr.name
        )
        FROM staff_rows sr),
        '{}'::types.q_list_staff_v4_staff[]
    ) as staff,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_list_staff_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_list_staff_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_list_staff_v4_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_list_staff_v4_department[]
    ) as departments,
    COALESCE(
        (SELECT ARRAY_AGG(
            (active_trend.date, active_trend.count::double precision, 0)::types.q_list_staff_v4_trend_data
            ORDER BY active_trend.date
        )
        FROM (
            SELECT 
                COALESCE((SELECT date FROM earliest_date), CURRENT_DATE) as date,
                (SELECT count FROM active_users_count) as count
            UNION ALL
            SELECT CURRENT_DATE as date, (SELECT count FROM active_users_count) as count
        ) active_trend),
        '{}'::types.q_list_staff_v4_trend_data[]
    ) as trend_data_active,
    COALESCE(
        (SELECT ARRAY_AGG(
            (auc.date, auc.cumulative_count::double precision, auc.daily_count)::types.q_list_staff_v4_trend_data
            ORDER BY auc.date
        )
        FROM admin_users_cumulative auc),
        '{}'::types.q_list_staff_v4_trend_data[]
    ) as trend_data_admin,
    COALESCE(
        (SELECT ARRAY_AGG(
            (iuc.date, iuc.cumulative_count::double precision, iuc.daily_count)::types.q_list_staff_v4_trend_data
            ORDER BY iuc.date
        )
        FROM instructional_users_cumulative iuc),
        '{}'::types.q_list_staff_v4_trend_data[]
    ) as trend_data_instructional,
    COALESCE(
        (SELECT ARRAY_AGG(
            (muc.date, muc.cumulative_count::double precision, muc.daily_count)::types.q_list_staff_v4_trend_data
            ORDER BY muc.date
        )
        FROM member_users_cumulative muc),
        '{}'::types.q_list_staff_v4_trend_data[]
    ) as trend_data_member,
    COALESCE(
        (SELECT ARRAY_AGG(
            (trc.date, trc.cumulative_count::double precision, trc.daily_count)::types.q_list_staff_v4_trend_data
            ORDER BY trc.date
        )
        FROM total_requests_cumulative trc),
        '{}'::types.q_list_staff_v4_trend_data[]
    ) as trend_data_total_requests,
    COALESCE(vdid.valid_department_ids, ARRAY[]::text[]) as valid_department_ids,
    CASE 
        WHEN up.role = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest', 'custom']::text[]
        WHEN up.role = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest', 'custom']::text[]
        ELSE ARRAY['instructional', 'member', 'guest']::text[]
    END as role_options,
    COALESCE(
        (SELECT ARRAY_AGG(cd.name ORDER BY cd.name)
         FROM cohorts_data cd),
        ARRAY[]::text[]
    ) as cohort_options,
    ARRAY['recent', 'moderate', 'old', 'never']::text[] as last_active_options
FROM user_profile up
CROSS JOIN valid_department_ids_data vdid
$$;
