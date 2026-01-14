-- Get departments list with permissions and computed fields
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
    title text,
    description text,
    active boolean,
    updated_at timestamptz,
    total_price_spent float,
    staff_count int,
    cohort_ids uuid[],
    profile_ids uuid[],
    can_edit boolean,
    can_delete boolean,
    can_duplicate boolean
);

CREATE TYPE types.q_list_departments_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_list_departments_v4_profile AS (
    profile_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_departments_v4(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    departments types.q_list_departments_v4_department[],
    cohorts types.q_list_departments_v4_cohort[],
    profiles types.q_list_departments_v4_profile[]
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
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = profile_artifact.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = profile_artifact.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = profile_artifact.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM params x
    JOIN profile_artifact ON profile_artifact.id = x.profile_id
),
model_run_costs AS (
    SELECT 
        rpu.run_id,
        COALESCE(SUM(
            (rpu.count::numeric / u.value::numeric) * pr.price
        ), 0) as cost
    FROM run_pricing_usage rpu
    JOIN run_models rm ON rm.run_id = rpu.run_id AND rm.active = true
    JOIN model_pricing mp ON mp.model_id = rm.model_id AND mp.active = true
    JOIN pricing_resource pr ON pr.id = mp.pricing_id
        AND pr.pricing_type = rpu.pricing_type 
        AND pr.unit_id = rpu.unit_id
        AND pr.active = true
    JOIN units u ON u.id = rpu.unit_id
    GROUP BY rpu.run_id
),
model_run_departments_via_agents AS (
    SELECT DISTINCT
        mrc.run_id,
        ad.department_id
    FROM model_run_costs mrc
    JOIN runs mr ON mr.id = mrc.run_id
    JOIN agent_departments ad ON NULL::uuid = mr.agent_id AND ad.active = true
    WHERE mr.agent_id IS NOT NULL
    AND ad.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments_via_personas AS (
    SELECT DISTINCT
        mrc.run_id,
        pd.department_id
    FROM model_run_costs mrc
    JOIN run_personas mrp ON mrp.run_id = mrc.run_id AND mrp.active = true
    JOIN persona_departments pd ON pd.persona_id = mrp.persona_id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments_via_profiles AS (
    SELECT DISTINCT
        mrc.run_id,
        pd.department_id
    FROM model_run_costs mrc
    JOIN run_profiles mrp ON mrp.run_id = mrc.run_id AND mrp.active = true
    JOIN profile_departments pd ON pd.profile_id = mrp.profile_id AND pd.active = true
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
),
model_run_departments AS (
    SELECT run_id, department_id FROM model_run_departments_via_agents
    UNION
    SELECT run_id, department_id FROM model_run_departments_via_personas
    UNION
    SELECT run_id, department_id FROM model_run_departments_via_profiles
),
department_price_spent AS (
    SELECT 
        mrd.department_id,
        SUM(mrc.cost) as total_price_spent
    FROM model_run_costs mrc
    JOIN model_run_departments mrd ON mrd.run_id = mrc.run_id
    GROUP BY mrd.department_id
),
department_staff_count AS (
    SELECT 
        department_id, 
        COUNT(DISTINCT profile_id) as staff_count
    FROM profile_departments
    WHERE department_id IN (SELECT department_id FROM user_departments)
    GROUP BY department_id
),
department_cohorts_data AS (
    SELECT 
        cd.department_id,
        ARRAY_AGG(cd.cohort_id ORDER BY cd.created_at) as cohort_ids
    FROM cohort_departments cd
    WHERE cd.department_id IN (SELECT department_id FROM user_departments) AND cd.active = true
    GROUP BY cd.department_id
),
department_profiles_data AS (
    SELECT 
        pd.department_id,
        ARRAY_AGG(pd.profile_id ORDER BY 
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1)
        ) as profile_ids
    FROM profile_departments pd
    JOIN profile_artifact p ON p.id = pd.profile_id
    WHERE pd.department_id IN (SELECT department_id FROM user_departments) AND pd.active = true
    GROUP BY pd.department_id
),
department_all_cohort_links AS (
    SELECT 
        cd.department_id,
        COUNT(*) as total_cohort_links
    FROM cohort_departments cd
    WHERE cd.department_id IN (SELECT department_id FROM user_departments) AND cd.active = true
    GROUP BY cd.department_id
),
department_profiles_would_orphan AS (
    SELECT 
        pd.department_id,
        COUNT(*) as profiles_with_only_this_dept
    FROM profile_departments pd
    WHERE pd.department_id IN (SELECT department_id FROM user_departments)
    AND NOT EXISTS (
        SELECT 1 FROM profile_departments pd2 
        WHERE pd2.profile_id = pd.profile_id 
        AND pd2.department_id != pd.department_id
    )
    GROUP BY pd.department_id
),
all_cohort_ids AS (
    SELECT DISTINCT unnest(cohort_ids) as cohort_id
    FROM department_cohorts_data
    WHERE cohort_ids IS NOT NULL
),
all_profile_ids_raw AS (
    SELECT DISTINCT unnest(profile_ids) as profile_id
    FROM department_profiles_data
    WHERE profile_ids IS NOT NULL
),
-- Role-based filtering: filter profiles based on role hierarchy
profile_roles_cte AS (
    SELECT 
        p.id as profile_id,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role
    FROM profile_artifact p
    WHERE p.id IN (SELECT profile_id FROM all_profile_ids_raw)
),
filtered_profile_ids AS (
    SELECT 
        pr.profile_id
    FROM params x
    CROSS JOIN user_profile up
    JOIN profile_roles_cte pr ON pr.profile_id IN (SELECT profile_id FROM all_profile_ids_raw)
    WHERE 
        -- superadmin can see all
        up.role = 'superadmin'::profile_role
        OR
        -- admin can see admin, instructional, member, guest
        (up.role = 'admin'::profile_role AND pr.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
        OR
        -- instructional can see instructional, member, guest
        (up.role = 'instructional'::profile_role AND pr.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role))
        OR
        -- member can see member, guest
        (up.role = 'member'::profile_role AND pr.role IN ('member'::profile_role, 'guest'::profile_role))
        OR
        -- guest can only see guest
        (up.role = 'guest'::profile_role AND pr.role = 'guest'::profile_role)
),
department_profiles_filtered_data AS (
    SELECT 
        pd.department_id,
        ARRAY_AGG(pd.profile_id ORDER BY 
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1)
        ) FILTER (WHERE pd.profile_id IN (SELECT profile_id FROM filtered_profile_ids)) as profile_ids,
        COUNT(DISTINCT pd.profile_id) FILTER (WHERE pd.profile_id IN (SELECT profile_id FROM filtered_profile_ids)) as staff_count
    FROM profile_departments pd
    JOIN profile_artifact p ON p.id = pd.profile_id
    WHERE pd.department_id IN (SELECT department_id FROM user_departments) AND pd.active = true
    GROUP BY pd.department_id
),
departments_data AS (
    SELECT 
        d.id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title,
        COALESCE((SELECT d2.description FROM department_descriptions dd2 JOIN descriptions_resource d2 ON dd2.description_id = d2.id WHERE dd2.department_id = d.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = TRUE) as active,
        d.updated_at,
        COALESCE(dps.total_price_spent, 0) as total_price_spent,
        COALESCE(dpf.staff_count, 0) as staff_count,
        COALESCE(dcd.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
        COALESCE(dpf.profile_ids, ARRAY[]::uuid[]) as profile_ids,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN COALESCE(dacl.total_cohort_links, 0) > 0 THEN false
            WHEN COALESCE(dpwo.profiles_with_only_this_dept, 0) > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete,
        CASE 
            WHEN up.role IN ('admin'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_duplicate
    FROM department_artifact d
    JOIN user_departments ud ON ud.department_id = d.id
    CROSS JOIN user_profile up
    LEFT JOIN department_price_spent dps ON dps.department_id = d.id
    LEFT JOIN department_profiles_filtered_data dpf ON dpf.department_id = d.id
    LEFT JOIN department_cohorts_data dcd ON dcd.department_id = d.id
    LEFT JOIN department_all_cohort_links dacl ON dacl.department_id = d.id
    LEFT JOIN department_profiles_would_orphan dpwo ON dpwo.department_id = d.id
    -- Only include departments with staff_count > 0 (after role filtering)
    WHERE COALESCE(dpf.staff_count, 0) > 0
),
cohorts_data AS (
    SELECT DISTINCT
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
profiles_data AS (
    SELECT DISTINCT
        p.id as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), '') as name,
        COALESCE((SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1), '') as description
    FROM profile_artifact p
    WHERE p.id IN (SELECT profile_id FROM filtered_profile_ids)
),
departments_agg AS (
    SELECT 
        up.actor_name,
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.title, dd.description, dd.active, dd.updated_at,
                 dd.total_price_spent, dd.staff_count, dd.cohort_ids, dd.profile_ids,
                 dd.can_edit, dd.can_delete, dd.can_duplicate)::types.q_list_departments_v4_department
                ORDER BY dd.title
            ),
            '{}'::types.q_list_departments_v4_department[]
        ) as departments
    FROM user_profile up
    CROSS JOIN departments_data dd
    GROUP BY up.actor_name
),
cohorts_agg AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (cd.cohort_id, cd.name, cd.description)::types.q_list_departments_v4_cohort
                ORDER BY cd.name
            ),
            '{}'::types.q_list_departments_v4_cohort[]
        ) as cohorts
    FROM (
        SELECT DISTINCT cohort_id, name, description
        FROM cohorts_data
    ) cd
),
profiles_agg AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (pd.profile_id, pd.name, pd.description)::types.q_list_departments_v4_profile
                ORDER BY pd.name
            ),
            '{}'::types.q_list_departments_v4_profile[]
        ) as profiles
    FROM (
        SELECT DISTINCT profile_id, name, description
        FROM profiles_data
    ) pd
)
SELECT 
    da.actor_name::text as actor_name,
    da.departments,
    ca.cohorts,
    pa.profiles
FROM departments_agg da
CROSS JOIN cohorts_agg ca
CROSS JOIN profiles_agg pa
$$;