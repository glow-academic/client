-- Get field new endpoint data
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_field_new_v3(uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_field_new_v3_department;
DROP TYPE IF EXISTS types.q_get_field_new_v3_parameter;

-- 3) Recreate types
CREATE TYPE types.q_get_field_new_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_field_new_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_field_new_v3(
    profile_id uuid
)
RETURNS TABLE (
    valid_department_ids text[],
    departments types.q_get_field_new_v3_department[],
    valid_parameter_ids text[],
    parameters types.q_get_field_new_v3_parameter[],
    user_role text,
    primary_department_id uuid,
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
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
            (vdd.department_id, vdd.name, vdd.description)::types.q_get_field_new_v3_department
            ORDER BY vdd.name
        ) FROM valid_departments_data vdd),
        '{}'::types.q_get_field_new_v3_department[]
    ) as departments,
    -- Valid parameter IDs
    (SELECT COALESCE(array_agg(parameter_id::text), ARRAY[]::text[])
     FROM valid_parameters_data) as valid_parameter_ids,
    -- Aggregate parameters
    COALESCE(
        (SELECT ARRAY_AGG(
            (vpd.parameter_id, vpd.name, vpd.description)::types.q_get_field_new_v3_parameter
            ORDER BY vpd.name
        ) FROM valid_parameters_data vpd),
        '{}'::types.q_get_field_new_v3_parameter[]
    ) as parameters,
    up.role::text as user_role,
    pdd.primary_department_id,
    up.actor_name
FROM user_profile up
LEFT JOIN primary_department_data pdd ON true
$$;

COMMIT;
