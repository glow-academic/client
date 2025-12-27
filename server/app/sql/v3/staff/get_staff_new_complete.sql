-- Get default staff detail for creation
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
        WHERE proname = 'api_get_staff_new_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_staff_new_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_staff_new_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_staff_new_v3_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_staff_new_v3_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_staff_new_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id text,
    valid_department_ids text[],
    valid_cohort_ids text[],
    role_options text[],
    cohorts types.q_get_staff_new_v3_cohort[],
    departments types.q_get_staff_new_v3_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
resolve_profile_id AS (
    SELECT profile_id AS resolved_profile_id FROM params
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
),
departments_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true
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
profile_data AS (
    SELECT 
        role as user_role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
)
SELECT 
    pd.actor_name::text as actor_name,
    pd.user_role::text as user_role,
    pdi.department_id::text as primary_department_id,
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
    ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[] as role_options,
    COALESCE(
        (SELECT ARRAY_AGG(
            (cd.cohort_id, cd.name, cd.description)::types.q_get_staff_new_v3_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_staff_new_v3_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_staff_new_v3_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_get_staff_new_v3_department[]
    ) as departments
FROM profile_data pd
LEFT JOIN primary_department_id pdi ON true
$$;

COMMIT;

