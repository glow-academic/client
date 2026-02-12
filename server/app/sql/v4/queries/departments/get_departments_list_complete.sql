-- Get departments list with resource-first pattern
-- Resource-first: only touches department_artifact + department's own junctions + resource tables
-- No cross-entity artifact tables (cohort_artifact, profile_artifact, etc.)
-- Permissions computed in Python, no pricing/filter option CTEs
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_list_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_list_departments_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_departments_v4_department AS (
    department_id uuid,
    name text,
    description text,
    is_inactive boolean,
    updated_at timestamptz,
    staff_count int,
    total_usage bigint
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_departments_v4(
    profile_id uuid,
    user_role text DEFAULT 'member',
    search text DEFAULT NULL,
    page_size int DEFAULT 12,
    page_offset int DEFAULT 0
)
RETURNS TABLE (
    departments types.q_list_departments_v4_department[],
    total_count bigint
)
LANGUAGE sql
STABLE
AS $$
-- User context (actor_name, user_role) comes from get_profile_context_internal() in Python
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments_junction ON profile_departments_junction.profile_id = x.profile_id AND profile_departments_junction.active = true
),
-- Get each profile's role for role-based staff count filtering
profile_roles_cte AS (
    SELECT
        pr.profile_id,
        COALESCE(r.role, 'member'::profile_type)::text as role
    FROM profile_roles_junction pr
    JOIN roles_resource r ON pr.role_id = r.id
),
-- Count visible profiles per department based on requesting user's role hierarchy
department_staff_count AS (
    SELECT pd.department_id, COUNT(DISTINCT pd.profile_id)::int as staff_count
    FROM profile_departments_junction pd
    WHERE pd.department_id IN (SELECT department_id FROM user_departments) AND pd.active = true
    AND pd.profile_id IN (
        SELECT pr.profile_id FROM profile_roles_cte pr
        WHERE user_role = 'superadmin'
           OR (user_role = 'admin' AND pr.role IN ('admin','instructional','member','guest'))
           OR (user_role = 'instructional' AND pr.role IN ('instructional','member','guest'))
           OR (user_role = 'member' AND pr.role IN ('member','guest'))
           OR (user_role = 'guest' AND pr.role = 'guest')
    )
    GROUP BY pd.department_id
),
-- Count usage across 5 junction tables (same as delete access check)
department_usage AS (
    SELECT d.id as department_id,
        (
            (SELECT COUNT(*) FROM simulation_departments_junction WHERE department_id = d.id AND active = true) +
            (SELECT COUNT(*) FROM scenario_departments_junction WHERE department_id = d.id AND active = true) +
            (SELECT COUNT(*) FROM persona_departments_junction WHERE department_id = d.id AND active = true) +
            (SELECT COUNT(*) FROM document_departments_junction WHERE department_id = d.id AND active = true) +
            (SELECT COUNT(*) FROM cohort_departments_junction WHERE department_id = d.id AND active = true)
        )::bigint as total_usage
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
-- Core department data
departments_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT desc_r.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_r ON dd.description_id = desc_r.id WHERE dd.department_id = d.id LIMIT 1), '') as description,
        NOT EXISTS (SELECT 1 FROM department_flags_junction df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'department_active' AND df.value = true) as is_inactive,
        d.updated_at,
        COALESCE(dsc.staff_count, 0) as staff_count,
        COALESCE(du.total_usage, 0) as total_usage
    FROM department_artifact d
    JOIN user_departments ud ON ud.department_id = d.id
    LEFT JOIN department_staff_count dsc ON dsc.department_id = d.id
    LEFT JOIN department_usage du ON du.department_id = d.id
    -- Only include departments with staff_count > 0 (after role filtering)
    WHERE COALESCE(dsc.staff_count, 0) > 0
),
-- Apply search filter
filtered_departments AS (
    SELECT dd.*
    FROM departments_data dd
    WHERE (search IS NULL OR LOWER(dd.name) LIKE '%' || LOWER(search) || '%')
),
-- Count total filtered results (before pagination)
filtered_count AS (
    SELECT COUNT(*)::bigint as total_count FROM filtered_departments
),
-- Paginate filtered results
paginated_departments AS (
    SELECT fd.*
    FROM filtered_departments fd
    ORDER BY fd.name ASC NULLS LAST
    LIMIT page_size OFFSET page_offset
)
SELECT
    -- Aggregate paginated departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.department_id, pd.name, pd.description, pd.is_inactive,
             pd.updated_at, pd.staff_count, pd.total_usage
            )::types.q_list_departments_v4_department
            ORDER BY pd.name ASC NULLS LAST
        ) FROM paginated_departments pd),
        '{}'::types.q_list_departments_v4_department[]
    ) as departments,
    -- Total count of filtered departments (before pagination)
    (SELECT total_count FROM filtered_count) as total_count
FROM params
$$;
