-- Search profiles for adding to a cohort
-- Converted to function with composite types
-- Reuses staff_item type from new endpoint where possible
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_cohort_search_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_cohort_search_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (reuse staff_item from new endpoint)
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE (typname LIKE 'q_get_cohort_search_v4_%' OR typname = 'q_get_cohort_new_v4_staff_item')
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse staff_item from new endpoint)
CREATE TYPE types.q_get_cohort_new_v4_staff_item AS (
    profile_id text,
    first_name text,
    last_name text,
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
    can_delete boolean,
    can_remove boolean
);

CREATE TYPE types.q_get_cohort_search_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_cohort_search_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_cohort_search_v4(
    p_profile_id uuid,
    p_cohort_id uuid DEFAULT NULL,
    p_query text DEFAULT NULL,
    p_dept_ids uuid[] DEFAULT ARRAY[]::uuid[],
    p_limit_count int DEFAULT 200
)
RETURNS TABLE (
    staff types.q_get_cohort_new_v4_staff_item[],
    cohorts types.q_get_cohort_search_v4_cohort[],
    departments types.q_get_cohort_search_v4_department[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT
        p_profile_id::uuid AS profile_id,
        p_cohort_id::uuid AS cohort_id,
        NULLIF(TRIM(p_query), '')::text AS query,
        (p_dept_ids::uuid[]) AS dept_filter,
        p_limit_count::int AS limit_count
),
user_profile AS (
    SELECT 
        COALESCE((SELECT r.role FROM params x JOIN profile_artifact p ON p.id = x.profile_id JOIN profile_roles pr_j ON pr_j.profile_id = p.id JOIN roles_resource r ON pr_j.role_id = r.id LIMIT 1), 'guest') as role,
        COALESCE(
            (SELECT (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) FROM params x JOIN profile_artifact p ON p.id = x.profile_id),
            'System'
        ) as actor_name
    FROM params
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
profile_cohorts AS (
    SELECT
        cp.profile_id,
        ARRAY_AGG(cp.cohort_id::text ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM profile_cohorts cp
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.active = true
    GROUP BY cp.profile_id
),
profile_departments_agg AS (
    SELECT
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as department_ids
    FROM profile_departments pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
recent_runs AS (
    SELECT
        rp.profile_id,
        COUNT(*) as run_count
    FROM runs r
    JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
    WHERE r.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY rp.profile_id
),
profile_total_runs AS (
    SELECT
        rp.profile_id,
        COUNT(*) as total_requests
    FROM run_profiles rp
    WHERE rp.active = true
    GROUP BY rp.profile_id
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohort_artifact c
    WHERE EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
staff_data AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as name,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE(SUBSTRING((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) FROM 1 FOR 1), '') || COALESCE(SUBSTRING((SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) FROM 1 FOR 1), '') as initials,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE) as active,
        pa.last_active as last_active,
        COALESCE(pc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
        COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
        (SELECT pd2.department_id FROM profile_departments pd2 WHERE pd2.profile_id = p.id AND pd2.active = true AND pd2.is_primary = true LIMIT 1) as primary_department_id,
        rl.requests_per_day as requests_per_day,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day,
        false as can_edit,
        false as can_delete,
        false as can_remove
    FROM params x
    JOIN profiles_resource p ON true
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
    LEFT JOIN recent_runs rr ON rr.profile_id = p.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT last_active
        FROM profile_activity
        WHERE profile_id = p.id
        ORDER BY created_at DESC
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile up
    WHERE (
        -- Superadmin sees all staff
        up.role = 'superadmin'
        OR
        -- For search, show all staff with active departments
        true
    )
    -- Search query filter (if provided)
    AND (
        x.query IS NULL
        OR (
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) ILIKE '%' || x.query || '%'
            OR (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) ILIKE '%' || x.query || '%'
            OR EXISTS (SELECT 1 FROM profile_emails pe_search JOIN emails_resource e_search ON pe_search.email_id = e_search.id WHERE pe_search.profile_id = p.id AND pe_search.active = true AND e_search.email ILIKE '%' || x.query || '%')
            OR (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1)::text ILIKE '%' || x.query || '%'
            OR (COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '')) ILIKE '%' || x.query || '%'
        )
    )
    -- Cohort exclusion filter (if cohort_id provided)
    AND (
        x.cohort_id IS NULL
        OR NOT EXISTS (SELECT 1 FROM public.profile_cohorts pct_exclude WHERE pct_exclude.profile_id = p.id AND pct_exclude.cohort_id = x.cohort_id AND pct_exclude.active = true)
    )
    -- Department filter (if department_ids provided)
    AND (
        array_length(x.dept_filter, 1) IS NULL
        OR EXISTS (SELECT 1 FROM profile_departments pd_filter WHERE pd_filter.profile_id = p.id AND pd_filter.department_id = ANY(x.dept_filter) AND pd_filter.active = true)
    )
    GROUP BY p.id, (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1), (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE),
             pa.last_active, rl.requests_per_day,
             pc.cohort_ids, pda.department_ids, ptr.total_requests, rr.run_count
    ORDER BY p.id, (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1)
    LIMIT (SELECT limit_count FROM params LIMIT 1)
)
SELECT 
    -- Aggregate staff separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (sd.profile_id::text, sd.first_name, sd.last_name, sd.emails, sd.primary_email, sd.name, sd.role, sd.initials, sd.active, sd.last_active, sd.cohort_ids, sd.department_ids, sd.primary_department_id, sd.requests_per_day, sd.total_requests, sd.requests_in_last_day, sd.can_edit, sd.can_delete, sd.can_remove)::types.q_get_cohort_new_v4_staff_item
            ORDER BY sd.last_name, sd.first_name
        ) FROM staff_data sd),
        '{}'::types.q_get_cohort_new_v4_staff_item[]
    ) as staff,
    -- Aggregate cohorts separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_cohort_search_v4_cohort
            ORDER BY cd.name
        ) FROM cohorts_data cd),
        '{}'::types.q_get_cohort_search_v4_cohort[]
    ) as cohorts,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_cohort_search_v4_department
            ORDER BY dd.name
        ) FROM departments_data dd),
        '{}'::types.q_get_cohort_search_v4_department[]
    ) as departments,
    up.actor_name
FROM user_profile up
$$;