-- Get profile detail with role visibility check and all fields needed for editing
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
        WHERE proname = 'api_get_profile_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_profile_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_profile_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_profile_detail_v3_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_detail_v3(
    target_profile_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    profile_exists boolean,
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
    can_edit boolean,
    valid_department_ids uuid[],
    valid_cohort_ids uuid[],
    departments types.q_get_profile_detail_v3_department[],
    cohorts types.q_get_profile_detail_v3_cohort[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT target_profile_id AS target_profile_id,
           profile_id AS profile_id
),
profile_exists_check AS (
    -- Check if profile exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM profiles WHERE id = (SELECT target_profile_id FROM params)
    )::boolean as profile_exists
),
resolve_current_profile_id AS (
    SELECT profile_id AS resolved_profile_id FROM params
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
target_profile_cohorts AS (
    SELECT 
        ARRAY_AGG(cp.cohort_id ORDER BY c.title) as cohort_ids
    FROM cohort_profiles cp
    JOIN cohorts c ON c.id = cp.cohort_id
    WHERE cp.profile_id = (SELECT target_profile_id FROM params) AND cp.active = true AND c.active = true
),
target_profile_departments AS (
    SELECT 
        ARRAY_AGG(pd.department_id ORDER BY d.title) as department_ids,
        (SELECT department_id FROM profile_departments WHERE profile_id = (SELECT target_profile_id FROM params) AND is_primary = TRUE AND active = true LIMIT 1) as primary_department_id
    FROM profile_departments pd
    JOIN departments d ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT target_profile_id FROM params) AND pd.active = true AND d.active = true
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohorts c
    WHERE c.active = true
),
all_cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        c.title as name,
        COALESCE(c.description, '') as description
    FROM cohorts c
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
        d.title as name,
        COALESCE(d.description, '') as description
    FROM resolve_current_profile_id rpi
    LEFT JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    LEFT JOIN departments d ON d.id = pd.department_id AND d.active = true
    WHERE rpi.resolved_profile_id IS NOT NULL
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
),
valid_departments_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(vdd.department_id ORDER BY vdd.name) FILTER (WHERE vdd.department_id IS NOT NULL), ARRAY[]::uuid[]) as valid_department_ids,
        COALESCE(
            ARRAY_AGG(
                (vdd.department_id, vdd.name, vdd.description)::types.q_get_profile_detail_v3_department
                ORDER BY vdd.name
            ) FILTER (WHERE vdd.department_id IS NOT NULL),
            '{}'::types.q_get_profile_detail_v3_department[]
        ) as departments
    FROM valid_departments_data vdd
    WHERE vdd.department_id IS NOT NULL
),
all_cohorts_agg AS (
    SELECT 
        COALESCE(ARRAY_AGG(acd.cohort_id ORDER BY acd.name) FILTER (WHERE acd.cohort_id IS NOT NULL), ARRAY[]::uuid[]) as valid_cohort_ids,
        COALESCE(
            ARRAY_AGG(
                (acd.cohort_id, acd.name, acd.description)::types.q_get_profile_detail_v3_cohort
                ORDER BY acd.name
            ) FILTER (WHERE acd.cohort_id IS NOT NULL),
            '{}'::types.q_get_profile_detail_v3_cohort[]
        ) as cohorts
    FROM all_cohorts_data acd
    WHERE acd.cohort_id IS NOT NULL
)
SELECT 
    -- Profile existence check (always returned)
    pec.profile_exists::boolean as profile_exists,
    -- Top-level profile fields
    vp.id as profile_id,
    vp.first_name,
    vp.last_name,
    vp.name,
    COALESCE(vp.emails, ARRAY[]::text[]) as emails,
    vp.primary_email,
    vp.role,
    vp.active,
    vp.requests_per_day,
    COALESCE(tpc.cohort_ids, ARRAY[]::uuid[]) as cohort_ids,
    COALESCE(tpd.department_ids, ARRAY[]::uuid[]) as department_ids,
    tpd.primary_department_id,
    COALESCE(cec.can_edit, false) as can_edit,
    COALESCE(vda.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(aca.valid_cohort_ids, ARRAY[]::uuid[]) as valid_cohort_ids,
    -- Aggregated arrays of composite types
    COALESCE(vda.departments, '{}'::types.q_get_profile_detail_v3_department[]) as departments,
    COALESCE(aca.cohorts, '{}'::types.q_get_profile_detail_v3_cohort[]) as cohorts,
    -- Actor name
    ap.actor_name
FROM profile_exists_check pec
CROSS JOIN actor_profile ap
CROSS JOIN valid_departments_agg vda
CROSS JOIN all_cohorts_agg aca
LEFT JOIN visible_profile vp ON pec.profile_exists = true
LEFT JOIN target_profile_cohorts tpc ON pec.profile_exists = true
LEFT JOIN target_profile_departments tpd ON pec.profile_exists = true
LEFT JOIN can_edit_check cec ON pec.profile_exists = true
LIMIT 1
$$;

COMMIT;

