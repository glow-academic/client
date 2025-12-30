-- Get staff detail with role visibility check and all fields needed for editing
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_staff_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_staff_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_staff_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_staff_detail_v3_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_staff_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_staff_detail_v3(
    target_profile_id uuid,  -- Target profile to view (comes from request body)
    profile_id uuid          -- Current user's profile (comes from header, filtered out of ApiRequest)
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
    cohorts types.q_get_staff_detail_v3_cohort[],
    departments types.q_get_staff_detail_v3_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT target_profile_id AS target_profile_id, profile_id AS current_profile_id
),
resolve_current_profile_id AS (
    SELECT current_profile_id AS resolved_profile_id FROM params
),
current_user_role AS (
    SELECT role FROM resolve_current_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_current_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
    WHERE rpi.resolved_profile_id IS NOT NULL
),
target_profile AS (
    SELECT 
        p.id,
        p.first_name,
        p.last_name,
        ARRAY_AGG(pe.email ORDER BY pe.is_primary DESC, pe.created_at) FILTER (WHERE pe.active = true) as emails,
        (SELECT email FROM profile_emails WHERE profile_id = p.id AND is_primary = true AND active = true LIMIT 1) as primary_email,
        p.role,
        p.active,
        prl.requests_per_day,
        COALESCE(p.first_name || ' ' || p.last_name, '') as name
    FROM profiles p
    LEFT JOIN profile_emails pe ON pe.profile_id = p.id AND pe.active = true
    LEFT JOIN profile_request_limits prl ON prl.profile_id = p.id AND prl.active = true
    WHERE p.id = (SELECT target_profile_id FROM params)
    GROUP BY p.id, p.first_name, p.last_name, p.role, p.active, prl.requests_per_day
),
staff_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM profiles WHERE id = (SELECT target_profile_id FROM params)
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
        ARRAY_AGG(cp.cohort_id::text ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.profile_id = (SELECT target_profile_id FROM params) AND cp.active = true AND c.active = true
),
target_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id::text ORDER BY d.title) as department_ids,
        (SELECT department_id::text FROM profile_departments WHERE profile_id = (SELECT target_profile_id FROM params) AND is_primary = TRUE AND active = true LIMIT 1) as primary_department_id
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT target_profile_id FROM params) AND pd.active = true AND d.active = true
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohorts c
    WHERE c.active = true
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        c.title as name,
        COALESCE(c.description, '') as description
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
departments_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments d ON d.id = pd.department_id AND d.active = true
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
    vp.first_name::text,
    vp.last_name::text,
    vp.name::text,
    COALESCE(vp.emails, ARRAY[]::text[]) as emails,
    vp.primary_email::text,
    vp.role::text,
    vp.active::boolean,
    vp.requests_per_day::integer,
    COALESCE(tpc.cohort_ids, ARRAY[]::text[]) as cohort_ids,
    COALESCE(tpd.department_ids, ARRAY[]::text[]) as department_ids,
    tpd.primary_department_id::text as primary_department_id,
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
            (cd.cohort_id, cd.name, cd.description)::types.q_get_staff_detail_v3_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_staff_detail_v3_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_staff_detail_v3_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_get_staff_detail_v3_department[]
    ) as departments
FROM staff_exists_check sec
LEFT JOIN visible_profile vp ON true
LEFT JOIN can_edit_check cec ON true
LEFT JOIN actor_profile ap ON true
LEFT JOIN target_profile_cohorts tpc ON true
LEFT JOIN target_profile_departments tpd ON true
$$;

COMMIT;

