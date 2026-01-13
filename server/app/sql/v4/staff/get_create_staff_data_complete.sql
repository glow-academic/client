-- Get create staff data (mappings, staff list, etc.)
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
        WHERE proname = 'api_get_create_staff_data_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_create_staff_data_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_create_staff_data_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_create_staff_data_v4_staff AS (
    profile_id uuid,
    first_name text,
    last_name text,
    emails text[],
    primary_email text,
    name text,
    role text,
    active boolean,
    last_active timestamptz,
    cohort_ids text[],
    department_ids text[],
    primary_department_id text,
    requests_per_day integer,
    total_requests bigint,
    requests_in_last_day integer
);

CREATE TYPE types.q_get_create_staff_data_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_create_staff_data_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_create_staff_data_v4(
    department_ids uuid[],
    profile_id uuid
)
RETURNS TABLE (
    actor_name text,
    staff types.q_get_create_staff_data_v4_staff[],
    cohorts types.q_get_create_staff_data_v4_cohort[],
    departments types.q_get_create_staff_data_v4_department[],
    role_options text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        COALESCE((SELECT role FROM profile_artifact WHERE id = (SELECT profile_id FROM params)), 'guest') as role,
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id AND pn.type = 'first' LIMIT 1) || ' ' || 
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile_artifact.id AND pn2.type = 'last' LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
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
    FROM cohort_profiles cp
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
profile_primary_department AS (
    SELECT 
        pd.profile_id,
        pd.department_id::text as department_id
    FROM profile_departments pd
    WHERE pd.active = true AND pd.is_primary = true
),
recent_runs AS (
    SELECT 
        mrp.profile_id,
        COUNT(*) as run_count
    FROM run_artifact mr
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
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohort_artifact c
    WHERE EXISTS (SELECT 1 FROM cohort_flags cf WHERE cf.cohort_id = c.id AND cf.type = 'active'::type_cohort_flags AND cf.value = true)
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
    WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
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
        p.role,
        EXISTS (SELECT 1 FROM profile_flags pf WHERE pf.profile_id = p.id AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE) as active,
        pa.last_active,
        COALESCE(
            ARRAY(SELECT unnest(pc.cohort_ids)::text),
            ARRAY[]::text[]
        ) as cohort_ids,
        COALESCE(
            ARRAY(SELECT unnest(pda.department_ids)::text),
            ARRAY[]::text[]
        ) as department_ids,
        COALESCE(ppd.department_id, '') as primary_department_id,
        prl.requests_per_day,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day
    FROM profile_artifact p
    JOIN profile_departments pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_cohorts pc ON pc.profile_id = p.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profile_id = p.id
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
    WHERE (
        -- Superadmin sees all staff
        up.role = 'superadmin'::profile_role
        OR
        -- For create-staff-data, show all staff with active departments
        true
    )
    GROUP BY p.id, (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1), (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), p.role, EXISTS (SELECT 1 FROM profile_flags pf WHERE pf.profile_id = p.id AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE),
             pa.last_active, prl.requests_per_day, pc.cohort_ids, pda.department_ids,
             ppd.department_id, ptr.total_requests, rr.run_count
    ORDER BY p.id, (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1)
)
SELECT 
    up.actor_name::text as actor_name,
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.first_name, sr.last_name, sr.emails, sr.primary_email, sr.name, sr.role, sr.active, sr.last_active, sr.cohort_ids, sr.department_ids, sr.primary_department_id, sr.requests_per_day, sr.total_requests, sr.requests_in_last_day)::types.q_get_create_staff_data_v4_staff
            ORDER BY sr.last_name, sr.first_name
        )
        FROM staff_rows sr),
        '{}'::types.q_get_create_staff_data_v4_staff[]
    ) as staff,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_create_staff_data_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_create_staff_data_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_create_staff_data_v4_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_get_create_staff_data_v4_department[]
    ) as departments,
    ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[] as role_options
FROM user_profile up
$$;