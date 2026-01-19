-- Search staff with query and filters
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
        WHERE proname = 'api_search_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_search_staff_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_search_staff_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_search_staff_v4_staff AS (
    profile_id uuid,
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
    can_delete boolean
);

CREATE TYPE types.q_search_staff_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_search_staff_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_search_staff_v4(
    query text,
    profile_id uuid,
    cohort_ids uuid[],
    department_ids uuid[],
    limit_count integer DEFAULT 200
)
RETURNS TABLE (
    actor_name text,
    staff types.q_search_staff_v4_staff[],
    cohorts types.q_search_staff_v4_cohort[],
    departments types.q_search_staff_v4_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        COALESCE(NULLIF(TRIM(query), ''), NULL) AS query,
        profile_id AS profile_id,
        COALESCE(cohort_ids, ARRAY[]::uuid[]) AS cohort_ids,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(limit_count, 200) AS limit_count
),
user_profile AS (
    SELECT 
        COALESCE((SELECT r.role FROM profile_roles pr_j 
                  JOIN roles_resource r ON pr_j.role_id = r.id 
                  WHERE pr_j.profile_id = (SELECT profile_id FROM params) 
                  LIMIT 1), 'guest') as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
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
        ARRAY_AGG(pd.department_id::text ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1)) as department_ids
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
staff_rows AS (
    SELECT DISTINCT ON (p.id)
        p.id as profile_id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        COALESCE(
            ARRAY(
                SELECT email FROM (
                    SELECT DISTINCT ON (e2.email) 
                        e2.email,
                        pe2.is_primary,
                        pe2.created_at
                    FROM profile_emails pe2
                    JOIN emails_resource e2 ON pe2.email_id = e2.id
                    WHERE pe2.profile_id = p.id AND pe2.active = true 
                    ORDER BY e2.email, pe2.is_primary DESC, pe2.created_at
                ) distinct_emails
                ORDER BY is_primary DESC, created_at
            ),
            ARRAY[]::text[]
        ) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as name,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE(SUBSTRING((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) FROM 1 FOR 1), '') || COALESCE(SUBSTRING((SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) FROM 1 FOR 1), '') as initials,
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE) as active,
        pa.last_active,
        COALESCE(
            ARRAY(SELECT unnest(pc.cohort_ids)::text),
            ARRAY[]::text[]
        ) as cohort_ids,
        COALESCE(
            ARRAY(SELECT unnest(pda.department_ids)::text),
            ARRAY[]::text[]
        ) as department_ids,
        COALESCE((SELECT pd2.department_id::text FROM profile_departments pd2 WHERE pd2.profile_id = p.id AND pd2.active = true AND pd2.is_primary = true LIMIT 1), '') as primary_department_id,
        rl.requests_per_day,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day
    FROM profile_artifact p
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
        up.role = 'superadmin'::profile_role
        OR
        -- For search, show all staff with active departments
        true
    )
    AND (
        -- Search query filter (if provided)
        (SELECT query FROM params) IS NULL
        OR (
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) ILIKE '%' || (SELECT query FROM params) || '%'
            OR (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) ILIKE '%' || (SELECT query FROM params) || '%'
            OR EXISTS (
                SELECT 1 FROM profile_emails pe_search
                JOIN emails_resource e_search ON pe_search.email_id = e_search.id
                WHERE pe_search.profile_id = p.id 
                AND pe_search.active = true 
                AND e_search.email ILIKE '%' || (SELECT query FROM params) || '%'
            )
            OR (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1)::text ILIKE '%' || (SELECT query FROM params) || '%'
            OR (COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '')) ILIKE '%' || (SELECT query FROM params) || '%'
        )
    )
    AND (
        -- Cohort exclusion filter (if provided)
        (SELECT array_length(cohort_ids, 1) FROM params) IS NULL
        OR (SELECT array_length(cohort_ids, 1) FROM params) = 0
        OR NOT EXISTS (
            SELECT 1 FROM public.profile_cohorts pce_table 
            WHERE pce_table.profile_id = p.id 
            AND pce_table.cohort_id = ANY((SELECT cohort_ids FROM params)::uuid[])
            AND pce_table.active = true
        )
    )
    AND (
        -- Department exclusion filter (if provided)
        (SELECT array_length(department_ids, 1) FROM params) IS NULL
        OR (SELECT array_length(department_ids, 1) FROM params) = 0
        OR NOT EXISTS (
            SELECT 1 FROM profile_departments pd_exclude 
            WHERE pd_exclude.profile_id = p.id 
            AND pd_exclude.department_id = ANY((SELECT department_ids FROM params)::uuid[])
            AND pd_exclude.active = true
        )
    )
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE),
             pa.last_active, rl.requests_per_day, pc.cohort_ids, pda.department_ids,
             ptr.total_requests, rr.run_count
    ORDER BY p.id, (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1)
    LIMIT (SELECT limit_count FROM params)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.first_name, sr.last_name, sr.emails, sr.primary_email, sr.name, sr.role, sr.initials, sr.active, sr.last_active, sr.cohort_ids, sr.department_ids, sr.primary_department_id, sr.requests_per_day, sr.total_requests, sr.requests_in_last_day, false, false)::types.q_search_staff_v4_staff
            ORDER BY sr.last_name NULLS LAST, sr.first_name NULLS LAST
        )
        FROM staff_rows sr),
        '{}'::types.q_search_staff_v4_staff[]
    ) as staff,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_search_staff_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_search_staff_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_search_staff_v4_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_search_staff_v4_department[]
    ) as departments
FROM user_profile up
$$;