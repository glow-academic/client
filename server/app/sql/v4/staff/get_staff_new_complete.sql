-- Get default staff detail for creation
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
        WHERE proname = 'api_get_staff_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_staff_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_staff_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_staff_new_v4_cohort AS (
    cohort_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_staff_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_staff_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id text,
    valid_department_ids text[],
    valid_cohort_ids text[],
    role_options text[],
    cohorts types.q_get_staff_new_v4_cohort[],
    departments types.q_get_staff_new_v4_department[],
    first_name text,
    last_name text,
    emails text[],
    primary_email_index integer,
    role text,
    requests_per_day integer,
    requests_per_day_enabled boolean,
    cohort_ids text[],
    department_ids text[],
    primary_department_index integer,
    active boolean,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id, draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
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
        (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.department_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_department_flags AND df.value = true)
),
all_cohort_ids AS (
    SELECT DISTINCT c.id as cohort_id
    FROM cohort c
    WHERE EXISTS (SELECT 1 FROM cohort_flags cf JOIN flags fl ON cf.flag_id = fl.id WHERE cf.cohort_id = c.id AND fl.name = 'active' AND cf.type = 'active'::type_cohort_flags AND cf.value = true)
),
cohorts_data AS (
    SELECT 
        c.id as cohort_id,
        (SELECT n.name FROM cohort_names cn JOIN names n ON cn.name_id = n.id WHERE cn.cohort_id = c.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM cohort_descriptions cd JOIN descriptions d ON cd.description_id = d.id WHERE cd.cohort_id = c.id LIMIT 1), '') as description
    FROM cohort c
    WHERE c.id IN (SELECT cohort_id FROM all_cohort_ids)
),
profile_data AS (
    SELECT 
        role as user_role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), 'System') as actor_name
    FROM resolve_profile_id rpi
    JOIN profile p ON p.id = rpi.resolved_profile_id
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
            (cd.cohort_id, cd.name, cd.description)::types.q_get_staff_new_v4_cohort
            ORDER BY cd.name
        )
        FROM cohorts_data cd),
        '{}'::types.q_get_staff_new_v4_cohort[]
    ) as cohorts,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dd.department_id, dd.name, dd.description)::types.q_get_staff_new_v4_department
            ORDER BY dd.name
        )
        FROM departments_data dd),
        '{}'::types.q_get_staff_new_v4_department[]
    ) as departments,
    -- Default values for new staff (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'firstName' FROM draft_payload_data),
        ''::text
    ) as first_name,
    COALESCE(
        (SELECT payload->>'lastName' FROM draft_payload_data),
        ''::text
    ) as last_name,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'emails' IS NOT NULL AND jsonb_typeof(payload->'emails') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'emails'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as emails,
    COALESCE(
        (SELECT (payload->>'primaryEmailIndex')::integer FROM draft_payload_data),
        NULL::integer
    ) as primary_email_index,
    COALESCE(
        (SELECT payload->>'role' FROM draft_payload_data),
        'instructional'::text
    ) as role,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->>'reqPerDay' IS NOT NULL AND payload->>'reqPerDay' != '' THEN
                    (payload->>'reqPerDay')::integer
                ELSE NULL
            END
        FROM draft_payload_data),
        NULL::integer
    ) as requests_per_day,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->>'reqPerDay' IS NOT NULL AND payload->>'reqPerDay' != '' THEN true
                ELSE false
            END
        FROM draft_payload_data),
        false::boolean
    ) as requests_per_day_enabled,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'cohortIds' IS NOT NULL AND jsonb_typeof(payload->'cohortIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'cohortIds'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as cohort_ids,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'departmentIds' IS NOT NULL AND jsonb_typeof(payload->'departmentIds') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds'))::text[]
                ELSE NULL
            END
        FROM draft_payload_data),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        (SELECT (payload->>'primaryDepartmentIndex')::integer FROM draft_payload_data),
        NULL::integer
    ) as primary_department_index,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT draft_version FROM draft_payload_data),
        0::int
    ) as draft_version
FROM profile_data pd
LEFT JOIN primary_department_id pdi ON true
$$;