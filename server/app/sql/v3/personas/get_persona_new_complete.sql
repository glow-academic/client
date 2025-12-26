-- Get default persona detail for creation
-- Converted to function with composite types

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DROP FUNCTION IF EXISTS api_get_persona_new_v3(uuid);

-- 2) Drop types WITHOUT CASCADE
DROP TYPE IF EXISTS types.q_get_persona_new_v3_department;
DROP TYPE IF EXISTS types.q_get_persona_new_v3_agent;
DROP TYPE IF EXISTS types.q_get_persona_new_v3_parameter;
DROP TYPE IF EXISTS types.q_get_persona_new_v3_field;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_new_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_new_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_new_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    numerical boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_persona_new_v3_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_new_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id uuid,
    valid_department_ids uuid[],
    valid_agent_ids uuid[],
    valid_parameter_ids uuid[],
    valid_parameter_item_ids uuid[],
    departments types.q_get_persona_new_v3_department[],
    agents types.q_get_persona_new_v3_agent[],
    parameters types.q_get_persona_new_v3_parameter[],
    fields types.q_get_persona_new_v3_field[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name,
        p.role as user_role
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
),
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM params x
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id
),
valid_department_ids_data AS (
    SELECT ARRAY_AGG(department_id ORDER BY name) as valid_department_ids
    FROM department_mapping_data
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
agent_mapping_data AS (
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM params x
    JOIN agents a ON a.active = true AND a.role IN ('simulation-text', 'simulation-voice')
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_agent_ids_data AS (
    SELECT ARRAY_AGG(agent_id ORDER BY name) as valid_agent_ids
    FROM agent_mapping_data
),
parameter_mapping_data AS (
    SELECT 
        p.id as parameter_id,
        p.name,
        COALESCE(p.description, '') as description,
        false as numerical,
        COALESCE(p.document_parameter, false) as document_parameter,
        COALESCE(p.persona_parameter, false) as persona_parameter,
        COALESCE(p.scenario_parameter, false) as scenario_parameter,
        COALESCE(p.video_parameter, false) as video_parameter
    FROM parameters p
    WHERE p.active = true AND p.persona_parameter = true
),
valid_parameter_ids_data AS (
    SELECT ARRAY_AGG(parameter_id ORDER BY name) as valid_parameter_ids
    FROM parameter_mapping_data
),
field_mapping_data AS (
    SELECT 
        f.id as field_id,
        f.name,
        COALESCE(f.description, '') as description,
        pf.parameter_id,
        p.name as parameter_name
    FROM parameter_mapping_data pmd
    JOIN parameter_fields pf ON pf.parameter_id = pmd.parameter_id AND pf.active = true
    JOIN fields f ON f.id = pf.field_id AND f.active = true
    JOIN parameters p ON p.id = pf.parameter_id
    WHERE p.active = true
),
valid_parameter_item_ids_data AS (
    SELECT ARRAY_AGG(field_id ORDER BY name) as valid_parameter_item_ids
    FROM field_mapping_data
)
SELECT 
    up.actor_name::text as actor_name,
    up.user_role::text as user_role,
    (SELECT department_id FROM primary_department_id_data) as primary_department_id,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_get_persona_new_v3_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_get_persona_new_v3_department[]
    ) as departments,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_get_persona_new_v3_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_get_persona_new_v3_agent[]
    ) as agents,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.numerical, 
             pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_persona_new_v3_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_new_v3_parameter[]
    ) as parameters,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name)::types.q_get_persona_new_v3_field
            ORDER BY fmd.name
        ) FROM field_mapping_data fmd),
        '{}'::types.q_get_persona_new_v3_field[]
    ) as fields
FROM user_profile up
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
$$;

COMMIT;
