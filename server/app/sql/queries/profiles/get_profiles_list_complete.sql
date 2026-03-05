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
    -- Drop old-named function (from before rename)
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_staff_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_staff_v4(%s)', r.sig);
    END LOOP;
    -- Drop new-named function
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_profiles_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_profiles_v4(%s)', r.sig);
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
        WHERE (typname LIKE 'q_list_staff_v4_%' OR typname LIKE 'q_list_profiles_v4_%')
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
-- Staff: NO can_edit/can_delete (moved to Python)
-- Added target_is_self for Python permission computation
CREATE TYPE types.q_list_profiles_v4_profile AS (
    profile_id uuid,
    emails text[],
    primary_email text,
    name text,
    role text,
    initials text,
    department_ids text[],
    primary_department_id text,
    requests_per_day integer,
    target_is_self boolean
);

-- Filter option type: value/label/count (names resolved in SQL)
CREATE TYPE types.q_list_profiles_v4_option AS (
    value text,
    label text,
    count bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_profiles_v4(
    profile_id uuid,
    search text DEFAULT NULL,
    filter_department_ids uuid[] DEFAULT NULL,
    role_filter text DEFAULT NULL,
    department_search text DEFAULT NULL,
    role_search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    profiles types.q_list_profiles_v4_profile[],
    department_options types.q_list_profiles_v4_option[],
    role_options types.q_list_profiles_v4_option[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT departments_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- User context: actor_name comes from get_profile_context_internal() in Python
user_profile AS (
    SELECT COALESCE(r.role, 'member'::profile_type) as role,
           ''::text as actor_name
    FROM profile_roles_junction prj
    JOIN roles_resource r ON prj.roles_id = r.id
    WHERE prj.profile_id = (SELECT profile_id FROM params)
    LIMIT 1
),
-- Profile's department IDs (already resource IDs)
profile_departments_agg AS (
    SELECT
        pd.profile_id,
        ARRAY_AGG(pd.departments_id::text ORDER BY pd.created_at) as department_ids
    FROM profile_departments_junction pd
    WHERE pd.active = true
    GROUP BY pd.profile_id
),
profile_primary_department AS (
    SELECT
        pd.profile_id,
        pd.departments_id::text as department_id
    FROM profile_departments_junction pd
    JOIN departments_resource dr ON dr.id = pd.departments_id
    WHERE pd.active = true AND dr.is_primary = true
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
                        e2.is_primary,
                        pe2.created_at
                    FROM profile_emails_junction pe2
                    JOIN emails_resource e2 ON pe2.emails_id = e2.id
                    WHERE pe2.profile_id = p.id AND pe2.active = true
                    ORDER BY e2.email, e2.is_primary DESC, pe2.created_at
                ) distinct_emails
                ORDER BY is_primary DESC, created_at
            ),
            ARRAY[]::text[]
        ) as emails,
        (SELECT e2.email FROM profile_emails_junction pe2 JOIN emails_resource e2 ON pe2.emails_id = e2.id WHERE pe2.profile_id = p.id AND e2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        COALESCE((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as name,
        (SELECT r.role FROM profile_roles_junction pr_j
         JOIN roles_resource r ON pr_j.roles_id = r.id
         WHERE pr_j.profile_id = p.id
         LIMIT 1) as role,
        COALESCE(SUBSTRING((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1) FROM 1 FOR 1), '') ||
        COALESCE(NULLIF(SUBSTRING(SPLIT_PART((SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1), ' ', 2) FROM 1 FOR 1), ''), '') as initials,
        rl.requests_per_day,
        COALESCE(pda.department_ids, ARRAY[]::text[]) as department_ids,
        COALESCE(ppd.department_id, '') as primary_department_id,
        -- For Python permission computation
        p.id = (SELECT profile_id FROM params) as target_is_self,
        p.updated_at
    FROM profile_artifact p
    LEFT JOIN profile_departments_junction pd ON pd.profile_id = p.id AND pd.active = true
    LEFT JOIN profile_departments_agg pda ON pda.profile_id = p.id
    LEFT JOIN profile_primary_department ppd ON ppd.profile_id = p.id
    LEFT JOIN profile_request_limits_junction prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limits_id = rl.id
    CROSS JOIN user_profile up
    WHERE (
        -- Superadmins see all profiles (bypass department filter)
        up.role = 'superadmin'::profile_type
        -- Non-superadmins only see profiles that share departments with them
        OR pd.departments_id IN (SELECT departments_id FROM user_departments)
    )
    AND (
        up.role = 'superadmin'::profile_type OR
        (up.role = 'admin'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.roles_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('admin'::profile_type, 'instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type, 'custom'::profile_type)) OR
        (up.role = 'instructional'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.roles_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('instructional'::profile_type, 'member'::profile_type, 'guest'::profile_type)) OR
        (up.role = 'member'::profile_type AND (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.roles_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1) IN ('member'::profile_type, 'guest'::profile_type)) OR
        (up.role = 'guest' AND EXISTS (SELECT 1 FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.roles_id = r.id WHERE pr_j.profile_id = p.id AND r.role = 'guest'::profile_type))
    )
    GROUP BY p.id, p.updated_at,
        (SELECT r.role FROM profile_roles_junction pr_j JOIN roles_resource r ON pr_j.roles_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1),
        rl.requests_per_day,
        pda.department_ids, ppd.department_id,
        up.role
    ORDER BY p.id, (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.names_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
),
-- Apply server-side filters
filtered_staff AS (
    SELECT sr.*
    FROM staff_rows sr
    WHERE
        -- Search filter: match name or email (case-insensitive)
        (search IS NULL OR LOWER(sr.name) LIKE '%' || LOWER(search) || '%' OR LOWER(sr.primary_email) LIKE '%' || LOWER(search) || '%')
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
-- Filter options with value/label/count (names resolved in SQL)
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM staff_rows
    WHERE department_ids IS NOT NULL AND array_length(department_ids, 1) > 0
),
-- Role options with counts from filtered staff
all_role_values AS (
    SELECT DISTINCT role as role_value
    FROM staff_rows
    WHERE role IS NOT NULL
),
available_roles AS (
    SELECT unnest(
        CASE
            WHEN (SELECT role FROM user_profile) = 'superadmin' THEN ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest', 'custom']::text[]
            WHEN (SELECT role FROM user_profile) = 'admin' THEN ARRAY['admin', 'instructional', 'member', 'guest', 'custom']::text[]
            ELSE ARRAY['instructional', 'member', 'guest']::text[]
        END
    ) as role_value
)
SELECT
    -- Aggregate paginated staff (no can_edit/can_delete — computed in Python)
    COALESCE(
        (SELECT ARRAY_AGG(
            (sr.profile_id, sr.emails, sr.primary_email, sr.name, sr.role, sr.initials, sr.department_ids, sr.primary_department_id, sr.requests_per_day,
             sr.target_is_self
            )::types.q_list_profiles_v4_profile
            ORDER BY sr.name ASC NULLS LAST
        )
        FROM paginated_staff sr),
        '{}'::types.q_list_profiles_v4_profile[]
    ) as profiles,
    -- Department filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (dr.id::text, dn_name.name, (SELECT COUNT(*) FROM staff_rows sr WHERE dr.id::text = ANY(sr.department_ids)))::types.q_list_profiles_v4_option
            ORDER BY dn_name.name
         )
         FROM departments_resource dr
         JOIN department_departments_junction ddj ON ddj.department_id = dr.id
         JOIN (SELECT dn.department_id, n.name FROM department_names_junction dn JOIN names_resource n ON dn.names_id = n.id) dn_name ON dn_name.department_id = ddj.department_id
         WHERE dr.id IN (SELECT department_id FROM all_department_ids)
           AND (department_search IS NULL OR LOWER(dn_name.name) LIKE '%' || LOWER(department_search) || '%')),
        '{}'::types.q_list_profiles_v4_option[]
    ) as department_options,
    -- Role filter options (value/label/count resolved in SQL)
    COALESCE(
        (SELECT ARRAY_AGG(
            (ar.role_value, INITCAP(ar.role_value), (SELECT COUNT(*) FROM staff_rows sr WHERE sr.role::text = ar.role_value))::types.q_list_profiles_v4_option
            ORDER BY ar.role_value
         )
         FROM available_roles ar
         WHERE (role_search IS NULL OR LOWER(ar.role_value) LIKE '%' || LOWER(role_search) || '%')),
        '{}'::types.q_list_profiles_v4_option[]
    ) as role_options,
    -- Total count of filtered staff (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM user_profile up
$$;

