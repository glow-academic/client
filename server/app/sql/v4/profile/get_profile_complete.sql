-- Unified get profile function - handles both new (profile_id = NULL) and detail (profile_id provided)
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
        WHERE proname = 'api_get_profile_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_profile_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_profile_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_profile_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_v4(
    profile_id uuid,
    target_profile_id uuid DEFAULT NULL
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    profile_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- Profile fields
    profile_id uuid,
    first_name text,
    last_name text,
    name text,
    emails text[],
    primary_email text,
    role text,
    active boolean,
    requests_per_day integer,
    cohort_ids uuid[],
    department_ids uuid[],
    primary_department_id uuid,
    valid_department_ids uuid[],
    valid_cohort_ids uuid[],
    departments types.q_get_profile_v4_department[],
    cohorts types.q_get_profile_v4_cohort[],
    role_options text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id,
           target_profile_id AS target_profile_id
),
profile_exists_check AS (
    -- Check if profile exists (only when target_profile_id is provided)
    SELECT 
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN false
            ELSE EXISTS(
                SELECT 1 FROM profile_artifact WHERE id = (SELECT target_profile_id FROM params)
            )
        END::boolean as profile_exists
),
resolve_current_profile_id AS (
    SELECT profile_id AS resolved_profile_id FROM params
),
resolve_target_profile_id AS (
    -- Use target_profile_id if provided, otherwise NULL (new mode)
    SELECT 
        CASE 
            WHEN (SELECT target_profile_id FROM params) IS NOT NULL 
            THEN (SELECT target_profile_id FROM params)
            ELSE NULL::uuid
        END as resolved_target_profile_id
),
current_user_role AS (
    SELECT (SELECT r.role FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            LIMIT 1) as role 
    FROM resolve_current_profile_id rpi
    JOIN profile_artifact p ON p.id = rpi.resolved_profile_id
),
actor_profile AS (
    SELECT 
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM resolve_current_profile_id rpi
    JOIN profile_artifact p ON p.id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
),
target_profile AS (
    SELECT 
        p.id,
        (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) as first_name,
        (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1) as last_name,
        ARRAY_AGG(e.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT e2.email FROM profile_emails pe2 JOIN emails_resource e2 ON pe2.email_id = e2.id WHERE pe2.profile_id = p.id AND pe2.is_primary = true AND pe2.active = true LIMIT 1) as primary_email,
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        EXISTS (SELECT 1 FROM profile_flags pf WHERE pf.profile_id = p.id AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE) as active,
        rl.requests_per_day,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), '') as name
    FROM resolve_target_profile_id rtp
    JOIN profile_artifact p ON p.id = rtp.resolved_target_profile_id
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE rtp.resolved_target_profile_id IS NOT NULL
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf WHERE pf.profile_id = p.id AND pf.type = 'active'::type_profile_flags AND pf.value = TRUE), rl.requests_per_day
),
role_visibility_check AS (
    -- Check if current user can see target profile based on role hierarchy (only in detail mode)
    SELECT 
        tp.*,
        CASE 
            WHEN cur.role = 'superadmin'::profile_role THEN true
            WHEN cur.role = 'admin'::profile_role AND tp.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND tp.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND tp.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'guest'::profile_role AND tp.role = 'guest'::profile_role THEN true
            ELSE false
        END as can_see
    FROM target_profile tp
    CROSS JOIN current_user_role cur
),
visible_profile AS (
    SELECT * FROM role_visibility_check WHERE can_see = true
),
target_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM resolve_target_profile_id rtp
    JOIN cohort_profiles cp ON cp.profile_id = rtp.resolved_target_profile_id
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE rtp.resolved_target_profile_id IS NOT NULL 
      AND cp.active = true 
      AND EXISTS (SELECT 1 FROM cohort_flags cf WHERE cf.cohort_id = c.id AND cf.type = 'active'::type_cohort_flags AND cf.value = true)
),
target_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as department_ids,
        (SELECT department_id FROM profile_departments WHERE profile_id = (SELECT resolved_target_profile_id FROM resolve_target_profile_id) AND is_primary = TRUE AND active = true LIMIT 1) as primary_department_id
    FROM resolve_target_profile_id rtp
    JOIN profile_departments pd ON pd.profile_id = rtp.resolved_target_profile_id
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE rtp.resolved_target_profile_id IS NOT NULL 
      AND pd.active = true 
      AND EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohort_artifact c
    WHERE EXISTS (SELECT 1 FROM cohort_flags cf WHERE cf.cohort_id = c.id AND cf.type = 'active'::type_cohort_flags AND cf.value = true)
),
all_cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions_resource d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort_artifact c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
current_user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_current_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
),
valid_departments_data AS (
    SELECT 
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments_resource d ON d.id = pd.department_id AND EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
    WHERE rpi.resolved_profile_id IS NOT NULL
),
can_edit_check AS (
    SELECT 
        CASE 
            -- New mode: user can always create profile
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN true
            -- Detail mode: check role hierarchy
            WHEN cur.role = 'superadmin'::profile_role THEN true
            WHEN cur.role = 'admin'::profile_role AND vp.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND vp.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND vp.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            ELSE false
        END as can_edit
    FROM resolve_target_profile_id rtp
    LEFT JOIN visible_profile vp ON rtp.resolved_target_profile_id IS NOT NULL
    CROSS JOIN current_user_role cur
    WHERE rtp.resolved_target_profile_id IS NULL OR vp.id IS NOT NULL
),
disabled_reason_check AS (
    SELECT 
        CASE 
            WHEN cec.can_edit = true THEN NULL::text
            WHEN (SELECT target_profile_id FROM params) IS NULL THEN NULL::text
            WHEN vp.id IS NULL THEN 'Profile not found or you do not have permission to view it'::text
            ELSE 'You do not have permission to edit this profile'::text
        END as disabled_reason
    FROM can_edit_check cec
    LEFT JOIN visible_profile vp ON (SELECT target_profile_id FROM params) IS NOT NULL
),
valid_departments_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(vdd.department_id ORDER BY vdd.name) FILTER (WHERE vdd.department_id IS NOT NULL), ARRAY[]::uuid[]) as valid_department_ids,
        COALESCE(
            ARRAY_AGG(
                (vdd.department_id, vdd.name, vdd.description)::types.q_get_profile_v4_department
                ORDER BY vdd.name
            ) FILTER (WHERE vdd.department_id IS NOT NULL),
            '{}'::types.q_get_profile_v4_department[]
        ) as departments
    FROM valid_departments_data vdd
    WHERE vdd.department_id IS NOT NULL
),
all_cohorts_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(acd.cohort_id ORDER BY acd.name) FILTER (WHERE acd.cohort_id IS NOT NULL), ARRAY[]::uuid[]) as valid_cohort_ids,
        COALESCE(
            ARRAY_AGG(
                (acd.cohort_id, acd.name, acd.description)::types.q_get_profile_v4_cohort
                ORDER BY acd.name
            ) FILTER (WHERE acd.cohort_id IS NOT NULL),
            '{}'::types.q_get_profile_v4_cohort[]
        ) as cohorts
    FROM all_cohorts_data acd
    WHERE acd.cohort_id IS NOT NULL
),
primary_department_id_new AS (
    SELECT department_id
    FROM resolve_current_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
)
SELECT 
    -- Required fields (first 5)
    COALESCE(ap.actor_name, '')::text as actor_name,
    pec.profile_exists::boolean as profile_exists,
    COALESCE(cec.can_edit, true)::boolean as can_edit,
    drc.disabled_reason,
    NULL::uuid as group_id,  -- Profile doesn't use group_id for resources
    -- Profile fields
    COALESCE(vp.id, NULL::uuid) as profile_id,
    COALESCE(vp.first_name, ''::text) as first_name,
    COALESCE(vp.last_name, ''::text) as last_name,
    COALESCE(vp.name, ''::text) as name,
    COALESCE(vp.emails, ARRAY[]::text[]) as emails,
    vp.primary_email,
    COALESCE(vp.role::text, 'instructional'::text) as role,
    COALESCE(vp.active, true)::boolean as active,
    vp.requests_per_day,
    COALESCE(tpc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
    COALESCE(tpd.department_ids, ARRAY[]::uuid[]) as department_ids,
    COALESCE(tpd.primary_department_id, pdi.department_id) as primary_department_id,
    COALESCE(vda.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(aca.valid_cohort_ids, ARRAY[]::uuid[]) as valid_cohort_ids,
    -- Aggregated arrays of composite types
    COALESCE(vda.departments, '{}'::types.q_get_profile_v4_department[]) as departments,
    COALESCE(aca.cohorts, '{}'::types.q_get_profile_v4_cohort[]) as cohorts,
    -- Role options (always available)
    ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[] as role_options
FROM profile_exists_check pec
CROSS JOIN actor_profile ap
CROSS JOIN valid_departments_agg vda
CROSS JOIN all_cohorts_agg aca
CROSS JOIN can_edit_check cec
CROSS JOIN disabled_reason_check drc
LEFT JOIN visible_profile vp ON pec.profile_exists = true
LEFT JOIN target_profile_cohorts tpc ON pec.profile_exists = true
LEFT JOIN target_profile_departments tpd ON pec.profile_exists = true
LEFT JOIN primary_department_id_new pdi ON pec.profile_exists = false
LIMIT 1
$$;
