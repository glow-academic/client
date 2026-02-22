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
    emails text[],
    primary_email text,
    name text,
    role text,
    initials text,
    active boolean,
    last_active timestamptz,
    department_ids text[],
    primary_department_id text,
    requests_per_day integer,
    total_requests bigint,
    requests_in_last_day integer,
    can_edit boolean,
    can_delete boolean
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
    department_ids uuid[],
    limit_count integer DEFAULT 200
)
RETURNS TABLE (
    staff types.q_search_staff_v4_staff[],
    departments types.q_search_staff_v4_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        COALESCE(NULLIF(TRIM(query), ''), NULL) AS query,
        profile_id AS profile_id,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        COALESCE(limit_count, 200) AS limit_count
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
profile_departments_agg AS (
    SELECT
        pd.profile_id,
        ARRAY_AGG(pd.department_id::text ORDER BY (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = ddj.department_id LIMIT 1)) as department_ids
    FROM profile_departments_junction pd
    JOIN departments_resource d ON d.id = pd.department_id
    JOIN department_departments_junction ddj ON ddj.departments_id = d.id
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
recent_runs AS (
    SELECT
        prj.profiles_id,
        COUNT(*) as run_count
    FROM profiles_runs_connection prj
    JOIN runs_entry r ON r.id = prj.run_id
    WHERE r.created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY prj.profiles_id
),
profile_total_runs AS (
    SELECT
        prj.profiles_id,
        COUNT(*) as total_requests
    FROM profiles_runs_connection prj
    JOIN runs_entry r ON r.id = prj.run_id
    GROUP BY prj.profiles_id
),
departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions_junction dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true)
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
        COALESCE(
            ARRAY(SELECT unnest(pda.department_ids)::text),
            ARRAY[]::text[]
        ) as department_ids,
        COALESCE((SELECT pd2.department_id::text FROM profile_departments_junction pd2 WHERE pd2.profile_id = p.id AND pd2.active = true AND pd2.is_primary = true LIMIT 1), '') as primary_department_id,
        rl.requests_per_day,
        COALESCE(ptr.total_requests, 0) as total_requests,
        COALESCE(rr.run_count::int, 0) as requests_in_last_day
    FROM profile_artifact p
    JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_emails_junction pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_total_runs ptr ON ptr.profiles_id = p.id
    LEFT JOIN recent_runs rr ON rr.profiles_id = p.id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    LEFT JOIN LATERAL (
        SELECT ae.last_active
        FROM profiles_activity_connection pactj
        JOIN activity_entry ae ON ae.id = pactj.activity_id
        WHERE pactj.profiles_id = p.id
        ORDER BY ae.created_at DESC
        LIMIT 1
    ) pa ON true
    CROSS JOIN user_profile up
    WHERE (
        -- Superadmin sees all staff
        up.role = 'superadmin'::profile_type
        OR
        -- For search, show all staff with active departments
        true
    )
    AND (
        -- Search query filter (if provided)
        (SELECT query FROM params) IS NULL
        OR (
            (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1) ILIKE '%' || (SELECT query FROM params) || '%'
            OR EXISTS (
                SELECT 1 FROM profile_emails_junction pe_search
                JOIN emails_resource e_search ON pe_search.email_id = e_search.id
                WHERE pe_search.profile_id = p.id 
                AND pe_search.active = true 
                AND e_search.email ILIKE '%' || (SELECT query FROM params) || '%'
            )
            OR (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1)::text ILIKE '%' || (SELECT query FROM params) || '%'
        )
    )
    AND (
        -- Department exclusion filter (if provided)
        (SELECT array_length(department_ids, 1) FROM params) IS NULL
        OR (SELECT array_length(department_ids, 1) FROM params) = 0
        OR NOT EXISTS (
            SELECT 1 FROM profile_departments_junction pd_exclude 
            WHERE pd_exclude.profile_id = p.id 
            AND pd_exclude.department_id = ANY((SELECT department_ids FROM params)::uuid[])
            AND pd_exclude.active = true
        )
    )
    GROUP BY p.id, (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags_junction pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'profile_active' AND pf.value = TRUE),
             pa.last_active, rl.requests_per_day, pda.department_ids,
             ptr.total_requests, rr.run_count
    ORDER BY p.id, (SELECT n2.name FROM profile_names_junction pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id LIMIT 1), (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
    LIMIT (SELECT limit_count FROM params)
)
SELECT 
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.emails, sr.primary_email, sr.name, sr.role, sr.initials, sr.active, sr.last_active, sr.department_ids, sr.primary_department_id, sr.requests_per_day, sr.total_requests, sr.requests_in_last_day, false, false)::types.q_search_staff_v4_staff
            ORDER BY sr.name NULLS LAST
        )
        FROM staff_rows sr),
        '{}'::types.q_search_staff_v4_staff[]
    ) as staff,
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

