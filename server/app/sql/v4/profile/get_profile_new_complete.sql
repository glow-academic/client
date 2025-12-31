-- Get default profile detail for creation
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
        WHERE proname = 'api_get_profile_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_profile_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_profile_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse same types as detail endpoint)
CREATE TYPE types.q_get_profile_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_profile_new_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_profile_new_v4(
    profile_id uuid
)
RETURNS TABLE (
    first_name text,
    last_name text,
    emails text[],
    role text,
    requests_per_day integer,
    primary_department_id uuid,
    active boolean,
    can_edit boolean,
    valid_department_ids uuid[],
    valid_cohort_ids uuid[],
    role_options text[],
    departments types.q_get_profile_new_v4_department[],
    cohorts types.q_get_profile_new_v4_cohort[],
    actor_name text
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
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id AND pd.active = true
),
valid_departments_data AS (
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
all_cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        c.title as name,
        COALESCE(c.description, '') as description
    FROM cohorts c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
),
actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
valid_departments_agg AS (
    SELECT 
        ARRAY_AGG(vdd.department_id ORDER BY vdd.name) as valid_department_ids,
        COALESCE(
            ARRAY_AGG(
                (vdd.department_id, vdd.name, vdd.description)::types.q_get_profile_new_v4_department
                ORDER BY vdd.name
            ) FILTER (WHERE vdd.department_id IS NOT NULL),
            '{}'::types.q_get_profile_new_v4_department[]
        ) as departments
    FROM valid_departments_data vdd
),
all_cohorts_agg AS (
    SELECT 
        ARRAY_AGG(acd.cohort_id ORDER BY acd.name) as valid_cohort_ids,
        COALESCE(
            ARRAY_AGG(
                (acd.cohort_id, acd.name, acd.description)::types.q_get_profile_new_v4_cohort
                ORDER BY acd.name
            ) FILTER (WHERE acd.cohort_id IS NOT NULL),
            '{}'::types.q_get_profile_new_v4_cohort[]
        ) as cohorts
    FROM all_cohorts_data acd
)
SELECT 
    -- Basic fields (empty defaults for creation)
    ''::text as first_name,
    ''::text as last_name,
    ARRAY['']::text[] as emails,
    'instructional'::text as role,  -- Default role
    NULL::integer as requests_per_day,  -- Unlimited by default
    pdi.department_id as primary_department_id,
    true::boolean as active,
    true::boolean as can_edit,  -- User can always create profile
    -- Metadata
    COALESCE(vda.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(aca.valid_cohort_ids, ARRAY[]::uuid[]) as valid_cohort_ids,
    ARRAY['superadmin', 'admin', 'instructional', 'member', 'guest']::text[] as role_options,
    -- Mappings (now arrays)
    COALESCE(vda.departments, '{}'::types.q_get_profile_new_v4_department[]) as departments,
    COALESCE(aca.cohorts, '{}'::types.q_get_profile_new_v4_cohort[]) as cohorts,
    -- Actor name
    ap.actor_name
FROM valid_departments_agg vda
CROSS JOIN all_cohorts_agg aca
CROSS JOIN profile_data pr
CROSS JOIN actor_profile ap
LEFT JOIN primary_department_id pdi ON true
LIMIT 1
$$;

COMMIT;

