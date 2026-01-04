-- Get field new endpoint data
-- Converted to function with composite types
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_field_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_field_new_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_field_new_v4_department;
DROP TYPE IF EXISTS types.q_get_field_new_v4_parameter;

-- 3) Recreate types
CREATE TYPE types.q_get_field_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_field_new_v4_parameter AS (
    parameter_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_field_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    valid_department_ids text[],
    departments types.q_get_field_new_v4_department[],
    valid_parameter_ids text[],
    parameters types.q_get_field_new_v4_parameter[],
    user_role text,
    primary_department_id uuid,
    actor_name text,
    draft_version int,
    name text,
    description text,
    active boolean,
    department_ids text[],
    conditional_parameter_ids text[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.version as draft_version,
        d.payload
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
        AND d.resource_type = 'fields'::draft_resource_type
        AND d.profile_id = x.profile_id
),
user_profile AS (
    SELECT 
        up.id,
        up.role,
        COALESCE(up.first_name || ' ' || up.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles up ON up.id = x.profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
valid_departments_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
       OR EXISTS (SELECT 1 FROM user_profile WHERE role = 'superadmin')
),
valid_parameters_data AS (
    SELECT 
        p.id as parameter_id,
        p.name,
        COALESCE(p.description, '') as description
    FROM parameters p
    WHERE p.active = true
),
primary_department_data AS (
    SELECT 
        pd.department_id as primary_department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
    ORDER BY pd.created_at
    LIMIT 1
)
SELECT 
    -- Valid department IDs
    (SELECT COALESCE(array_agg(department_id::text), ARRAY[]::text[])
     FROM valid_departments_data) as valid_department_ids,
    -- Aggregate departments
    COALESCE(
        (SELECT ARRAY_AGG(
            (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_new_v4_department
            ORDER BY vdd.name
        ) FROM valid_departments_data vdd),
        '{}'::types.q_get_field_new_v4_department[]
    ) as departments,
    -- Valid parameter IDs
    (SELECT COALESCE(array_agg(parameter_id::text), ARRAY[]::text[])
     FROM valid_parameters_data) as valid_parameter_ids,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (vpd.parameter_id, vpd.name, vpd.description)::types.q_get_field_new_v4_parameter
            ORDER BY vpd.name
        ) FROM valid_parameters_data vpd),
        '{}'::types.q_get_field_new_v4_parameter[]
    ) as parameters,
    up.role::text as user_role,
    pdd.primary_department_id,
    up.actor_name,
    -- Draft fields
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        'New Field'
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true
    ) as active,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'departmentIds')) FROM draft_payload_data),
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'conditionalParameterIds')) FROM draft_payload_data),
        ARRAY[]::text[]
    ) as conditional_parameter_ids
FROM user_profile up
LEFT JOIN primary_department_data pdd ON true
LEFT JOIN draft_payload_data dpd ON true
$$;