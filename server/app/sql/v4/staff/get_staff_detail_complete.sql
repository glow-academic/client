-- Get staff detail with role visibility check and all fields needed for editing
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
        WHERE proname = 'api_get_staff_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_staff_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_staff_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_staff_detail_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_staff_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_staff_detail_v4(
    target_profile_id uuid,  -- Target profile to view (comes from request body)
    profile_id uuid,         -- Current user's profile (comes from header, filtered out of ApiRequest)
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    staff_exists boolean,
    actor_name text,
    profile_id uuid,
    first_name text,
    last_name text,
    name text,
    emails text[],
    primary_email text,
    role text,
    active boolean,
    requests_per_day integer,
    cohort_ids text[],
    department_ids text[],
    primary_department_id text,
    can_edit boolean,
    valid_department_ids text[],
    valid_cohort_ids text[],
    cohorts types.q_get_staff_detail_v4_cohort[],
    departments types.q_get_staff_detail_v4_department[],
    primary_email_index integer,
    primary_department_index integer,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT target_profile_id AS target_profile_id, profile_id AS current_profile_id, draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.current_profile_id
    
    LIMIT 1
),
resolve_current_profile_id AS (
    SELECT current_profile_id AS resolved_profile_id FROM params
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
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE),
        rl.requests_per_day,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), '') as name
    FROM profile_artifact p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN emails_resource e ON pe.email_id = e.id
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
    WHERE p.id = (SELECT target_profile_id FROM params)
    GROUP BY p.id, (SELECT r.role FROM profile_roles pr_j JOIN roles_resource r ON pr_j.role_id = r.id WHERE pr_j.profile_id = p.id LIMIT 1), EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = p.id AND f.name = 'active' AND pf.value = TRUE), rl.requests_per_day
),
staff_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM profile_artifact WHERE id = (SELECT target_profile_id FROM params)
    )::boolean as staff_exists
),
role_visibility_check AS (
    -- Check if current user can see target profile based on role hierarchy
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
current_user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_current_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
),
target_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id::text ORDER BY (SELECT n.name FROM cohort_names cn JOIN names_resource n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1)) as cohort_ids
    FROM profile_cohorts cp
    JOIN cohort_artifact c ON c.id = cp.cohort_id
    WHERE cp.profile_id = (SELECT target_profile_id FROM params) AND cp.active = true AND EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags_resource f ON cf.flag_id = f.id WHERE cf.cohort_id = c.id AND f.name = 'active' AND cf.value = true)
),
target_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id::text ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as department_ids,
        (SELECT department_id::text FROM profile_departments WHERE profile_id = (SELECT target_profile_id FROM params) AND is_primary = TRUE AND active = true LIMIT 1) as primary_department_id
    FROM profile_departments pd
    JOIN departments_resource d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT target_profile_id FROM params) AND pd.active = true AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
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
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments_resource d ON d.id = pd.department_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
    WHERE rpi.resolved_profile_id IS NOT NULL AND d.id IS NOT NULL
),
can_edit_check AS (
    SELECT 
        CASE 
            WHEN cur.role = 'superadmin'::profile_role THEN true
            WHEN cur.role = 'admin'::profile_role AND vp.role IN ('admin'::profile_role, 'instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'instructional'::profile_role AND vp.role IN ('instructional'::profile_role, 'member'::profile_role, 'guest'::profile_role) THEN true
            WHEN cur.role = 'member'::profile_role AND vp.role IN ('member'::profile_role, 'guest'::profile_role) THEN true
            ELSE false
        END as can_edit
    FROM visible_profile vp
    CROSS JOIN current_user_role cur
)
SELECT 
    sec.staff_exists::boolean as staff_exists,
    COALESCE(ap.actor_name, '')::text as actor_name,
    vp.id as profile_id,
    -- Merge draft payload with existing staff data (draft takes precedence)
    COALESCE(
        (SELECT payload->>'firstName' FROM draft_payload_data),
        vp.first_name::text
    ) as first_name,
    COALESCE(
        (SELECT payload->>'lastName' FROM draft_payload_data),
        vp.last_name::text
    ) as last_name,
    COALESCE(
        (SELECT payload->>'firstName' FROM draft_payload_data) || ' ' || 
        COALESCE((SELECT payload->>'lastName' FROM draft_payload_data), ''),
        vp.name::text
    ) as name,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'emails' IS NOT NULL AND jsonb_typeof(payload->'emails') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'emails'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(vp.emails, ARRAY[]::text[])
    ) as emails,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'emails' IS NOT NULL AND jsonb_typeof(payload->'emails') = 'array' AND
                     (payload->>'primaryEmailIndex') IS NOT NULL THEN
                    (ARRAY(SELECT jsonb_array_elements_text(payload->'emails'))::text[])[
                        COALESCE((payload->>'primaryEmailIndex')::integer, 0) + 1
                    ]
                ELSE NULL
            END
        FROM draft_payload_data),
        vp.primary_email::text
    ) as primary_email,
    COALESCE(
        (SELECT payload->>'role' FROM draft_payload_data),
        vp.role::text
    ) as role,
        COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        EXISTS (SELECT 1 FROM profile_flags pf JOIN flags_resource f ON pf.flag_id = f.id WHERE pf.profile_id = vp.id AND f.name = 'active' AND pf.value = TRUE)
    ) as active,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->>'reqPerDay' IS NOT NULL AND payload->>'reqPerDay' != '' THEN
                    (payload->>'reqPerDay')::integer
                ELSE NULL
            END
        FROM draft_payload_data),
        vp.requests_per_day::integer
    ) as requests_per_day,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'cohortIds' IS NOT NULL AND jsonb_typeof(payload->'cohortIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'cohortIds'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(tpc.cohort_ids, ARRAY[]::text[])
    ) as cohort_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        COALESCE(tpd.department_ids, ARRAY[]::text[])
    ) as department_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' AND
                     (payload->>'primaryDepartmentIndex') IS NOT NULL THEN
                    (ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::text[])[
                        COALESCE((payload->>'primaryDepartmentIndex')::integer, 0) + 1
                    ]
                ELSE NULL
            END
        FROM draft_payload_data),
        tpd.primary_department_id::text
    ) as primary_department_id,
    COALESCE(cec.can_edit, false)::boolean as can_edit,
    COALESCE(
        (SELECT array_agg(dd.department_id::text ORDER BY dd.name)
         FROM departments_data dd),
        ARRAY[]::text[]
    ) as valid_department_ids,
    COALESCE(
        (SELECT array_agg(cd.cohort_id::text ORDER BY cd.name)
         FROM cohorts_data cd),
        ARRAY[]::text[]
    ) as valid_cohort_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_staff_detail_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_staff_detail_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_staff_detail_v4_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_get_staff_detail_v4_department[]
    ) as departments,
    COALESCE(
        (SELECT (payload->>'primaryEmailIndex')::integer FROM draft_payload_data),
        CASE 
            WHEN vp.emails IS NOT NULL AND vp.primary_email IS NOT NULL THEN
                array_position(vp.emails, vp.primary_email) - 1
            ELSE NULL
        END::integer
    ) as primary_email_index,
    COALESCE(
        (SELECT (payload->>'primaryDepartmentIndex')::integer FROM draft_payload_data),
        CASE 
            WHEN tpd.department_ids IS NOT NULL AND tpd.primary_department_id IS NOT NULL THEN
                array_position(tpd.department_ids, tpd.primary_department_id) - 1
            ELSE NULL
        END::integer
    ) as primary_department_index,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0::int
    ) as draft_version
FROM staff_exists_check sec
LEFT JOIN visible_profile vp ON true
LEFT JOIN can_edit_check cec ON true
LEFT JOIN actor_profile ap ON true
LEFT JOIN target_profile_cohorts tpc ON true
LEFT JOIN target_profile_departments tpd ON true
$$;