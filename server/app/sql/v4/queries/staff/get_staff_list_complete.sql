-- Get staff list with permissions and relationships
-- Resource-first: only touches profile_artifact + profile's own junctions + resource tables
-- No cross-entity artifact tables (cohort_artifact, department_artifact, etc.)
-- Permissions (can_edit/can_delete) computed in Python via role hierarchy
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
-- Staff: NO can_edit/can_delete (moved to Python)
-- Added target_is_self + total_cohort_links for Python permission computation
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
    target_is_self boolean,
    total_cohort_links bigint
);

-- Filter option: id + count only (names hydrated in Python)
CREATE TYPE types.q_list_staff_v4_option_id AS (
    id uuid,
    count bigint
);

-- Trend data: unchanged
CREATE TYPE types.q_list_staff_v4_trend_data AS (
    date date,
    value double precision,
    count integer
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_staff_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    cohort_ids uuid[] DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    role_filter text DEFAULT NULL,
    cohort_search text DEFAULT NULL,
    department_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    staff types.q_list_staff_v4_staff[],
    cohort_option_ids types.q_list_staff_v4_option_id[],
    department_option_ids types.q_list_staff_v4_option_id[],
    trend_data_active types.q_list_staff_v4_trend_data[],
    trend_data_admin types.q_list_staff_v4_trend_data[],
    trend_data_instructional types.q_list_staff_v4_trend_data[],
    trend_data_member types.q_list_staff_v4_trend_data[],
    trend_data_total_requests types.q_list_staff_v4_trend_data[],
    role_options text[],
    last_active_options text[],
    total_count bigint
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
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.role_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Profile's cohort links: bridge through cohort_cohorts_junction to get resource IDs
profile_cohorts_data AS (
    SELECT
        cp.profile_id,
        ARRAY_AGG(ccj.cohorts_id::text ORDER BY ccj.created_at) as cohort_ids
    FROM profile_cohorts_junction cp
    JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = cp.cohort_id AND ccj.active = true
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
-- Total cohort links (for delete permission - includes inactive)
profile_all_cohort_links AS (
    SELECT
        profile_id,
        COUNT(*) as total_cohort_links
    FROM profile_cohorts_junction
    GROUP BY profile_id
),
-- Profile's department IDs (already resource IDs)
profile_departments_agg AS (
    SELECT
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM profile_departments_junction pd
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
-- Request counts
recent_runs AS (
    SELECT
        prj.profiles_id,
        COUNT(*) as run_count
    FROM profiles_runs_connection prj
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    WHERE mr.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY prj.profiles_id
),
profile_total_runs AS (
    SELECT
        prj.profiles_id,
        COUNT(*) as total_requests
    FROM profiles_runs_connection prj
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    GROUP BY prj.profiles_id
),
-- Base staff data: profile's own junctions only
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
        COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(ppd.department_id, '') as primary_department_id,
        COALESCE(ptr.total_requests, 0) as total_requests,
        -- For Python permission computation
        p.id = (SELECT profile_id FROM params) as target_is_self,
        COALESCE(pacl_all.total_cohort_links, 0) as total_cohort_links,
        p.updated_at
    FROM profile_artifact p
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_cohorts_data pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profiles_id = p.id
    LEFT JOIN profile_all_cohort_links pacl_all ON pacl_all.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profiles_id = p.id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT ae.last_active
        FROM profiles_activity_connection pactj
        JOIN view_activity_entry ae ON ae.id = pactj.activity_id
        WHERE pactj.profiles_id = p.id
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
    GROUP BY p.id, p.updated_at,
        (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1),
        EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE),
        pa.last_active, rl.requests_per_day,
        pc.cohort_ids, pda.department_ids, ppd.department_id, ptr.total_requests,
        pacl_all.total_cohort_links, rr.run_count, up.role
    ORDER BY p.id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
),
-- Apply server-side filters
filtered_staff AS (
    SELECT sr.*
    FROM staff_rows sr
    WHERE
        -- Search filter: match name or email (case-insensitive)
        (search IS NULL OR LOWER(sr.name) LIKE '%' || LOWER(search) || '%' OR LOWER(sr.primary_email) LIKE '%' || LOWER(search) || '%')
        -- Cohort filter: staff must be linked to at least one selected cohort (resource IDs)
        AND (api_list_staff_v4.cohort_ids IS NULL OR sr.cohort_ids && api_list_staff_v4.cohort_ids::text[])
        -- Department filter: staff must belong to at least one selected department
        AND (filter_department_ids IS NULL OR sr.department_ids && filter_department_ids::text[])
        -- Role filter: match role
        AND (role_filter IS NULL OR sr.role::text = role_filter)
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_staff
),
-- Paginate filtered results
paginated_staff AS (
    SELECT fs.*
    FROM filtered_staff fs
    ORDER BY fs.name ASC NULLS LAST
    LIMIT page_size OFFSET page_offset
),
-- Filter option IDs with counts (names hydrated in Python from cached *_internal() functions)
-- Cohort option IDs: resource IDs from cohort_cohorts_junction
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids)::uuid as cohort_id
    FROM staff_rows
),
cohort_option_data AS (
    SELECT
        cr.id,
        (SELECT COUNT(*) FROM staff_rows sr WHERE cr.id::text = ANY(sr.cohort_ids)) as count
    FROM cohorts_resource cr
    WHERE cr.id IN (SELECT cohort_id FROM all_cohort_ids)
),
-- Department option IDs: already resource IDs
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM staff_rows
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
),
department_option_data AS (
    SELECT
        dr.id,
        (SELECT COUNT(*) FROM staff_rows sr WHERE dr.id::text = ANY(sr.department_ids)) as count
    FROM departments_resource dr
    WHERE dr.id IN (SELECT department_id FROM all_department_ids)
),
-- Trend data CTEs (analytics, no resource equivalent — kept in SQL)
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
    FROM profiles_runs_connection prj
    JOIN view_runs_entry mr ON mr.id = prj.run_id
    JOIN profile_departments_junction pd ON pd.profile_id = prj.profiles_id AND pd.active = true
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
)
SELECT
    -- Aggregate paginated staff (no can_edit/can_delete — computed in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.emails, sr.primary_email, sr.name, sr.role, sr.initials, sr.active, sr.last_active, sr.cohort_ids, sr.department_ids, sr.primary_department_id, sr.requests_per_day, sr.total_requests, sr.requests_in_last_day,
             sr.target_is_self, sr.total_cohort_links
            )::types.q_list_staff_v4_staff
            ORDER BY sr.name ASC NULLS LAST
        )
        FROM paginated_staff sr),
        '{}'::types.q_list_staff_v4_staff[]
    ) as staff,
    -- Cohort option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (cod.id, cod.count)::types.q_list_staff_v4_option_id
        ) FROM cohort_option_data cod),
        '{}'::types.q_list_staff_v4_option_id[]
    ) as cohort_option_ids,
    -- Department option IDs with counts (names hydrated in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dod.id, dod.count)::types.q_list_staff_v4_option_id
        ) FROM department_option_data dod),
        '{}'::types.q_list_staff_v4_option_id[]
    ) as department_option_ids,
    -- Trend data (analytics — kept in SQL)
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
    CASE
        WHEN up.role = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest', 'custom']::text[]
        WHEN up.role = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest', 'custom']::text[]
        ELSE ARRAY['instructional', 'member', 'guest']::text[]
    END as role_options,
    ARRAY['recent', 'moderate', 'old', 'never']::text[] as last_active_options,
    -- Total count of filtered staff (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM user_profile up
$$;

