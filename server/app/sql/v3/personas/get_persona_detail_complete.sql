-- Get persona detail with agents, departments, and access control
-- Converted to function with composite types

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
        WHERE proname = 'api_get_persona_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_persona_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_persona_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_persona_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_detail_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_get_persona_detail_v3_parameter AS (
    parameter_id uuid,
    name text,
    description text,
    numerical boolean,
    document_parameter boolean,
    persona_parameter boolean,
    scenario_parameter boolean,
    video_parameter boolean
);

CREATE TYPE types.q_get_persona_detail_v3_field AS (
    field_id uuid,
    name text,
    description text,
    parameter_id uuid,
    parameter_name text
);

CREATE TYPE types.q_get_persona_detail_v3_example AS (
    example_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_persona_detail_v3_example_history_item AS (
    example text,
    department_ids text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_persona_detail_v3(
    persona_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    persona_exists boolean,
    name text,
    description text,
    department_ids uuid[],
    active boolean,
    color text,
    icon text,
    instructions text,
    in_use boolean,
    scenario_count bigint,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    valid_department_ids uuid[],
    valid_agent_ids uuid[],
    valid_parameter_ids uuid[],
    valid_parameter_item_ids uuid[],
    linked_parameter_ids uuid[],
    parameter_field_ids uuid[],
    example_ids uuid[],
    actor_name text,
    departments types.q_get_persona_detail_v3_department[],
    agents types.q_get_persona_detail_v3_agent[],
    parameters types.q_get_persona_detail_v3_parameter[],
    fields types.q_get_persona_detail_v3_field[],
    examples types.q_get_persona_detail_v3_example[],
    examples_history types.q_get_persona_detail_v3_example_history_item[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT persona_id AS persona_id,
           profile_id AS profile_id
),
persona_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM personas WHERE id = (SELECT persona_id FROM params)
    )::boolean as persona_exists
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    WHERE pd.persona_id = (SELECT persona_id FROM params) AND pd.active = true
    GROUP BY pd.persona_id
),
persona_department_access_check AS (
    SELECT 
        p.id as persona_id,
        CASE 
            WHEN up.role = 'superadmin' THEN true
            WHEN EXISTS (
                SELECT 1 FROM persona_departments pd 
                WHERE pd.persona_id = p.id 
                AND pd.active = true 
                AND pd.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM persona_departments pd3 
                WHERE pd3.persona_id = p.id 
                AND pd3.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN personas p ON p.id = x.persona_id
    CROSS JOIN user_profile up
),
persona_data AS (
    SELECT 
        p.name,
        p.description,
        p.active,
        p.color,
        p.icon,
        p.instructions,
        COALESCE(pdd.department_ids, NULL) as department_ids
    FROM params x
    JOIN personas p ON p.id = x.persona_id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    INNER JOIN persona_department_access_check pdac ON pdac.persona_id = p.id AND pdac.has_access = true
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
agent_mapping_data AS (
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM agents a
    WHERE a.active = true
    AND a.role IN ('simulation-text', 'simulation-voice')
    AND (
        EXISTS (
            SELECT 1 FROM agent_departments ad 
            WHERE ad.agent_id = a.id 
            AND ad.active = true 
            AND ad.department_id IN (SELECT department_id FROM user_departments)
        )
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = a.id 
            AND ad2.active = true
        )
    )
),
valid_agent_ids_data AS (
    SELECT ARRAY_AGG(agent_id) as valid_agent_ids
    FROM agent_mapping_data
),
usage_data AS (
    SELECT COUNT(*) as usage_count
    FROM params x
    JOIN scenario_personas sp ON sp.persona_id = x.persona_id AND sp.active = true
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
linked_parameter_ids_data AS (
    SELECT ARRAY[]::uuid[] as linked_parameter_ids
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
),
parameter_field_ids_data AS (
    SELECT ARRAY[]::uuid[] as parameter_field_ids
),
persona_examples_data AS (
    SELECT 
        ARRAY_AGG(e.id ORDER BY pe.idx) as example_ids
    FROM params x
    JOIN persona_examples pe ON pe.persona_id = x.persona_id
    JOIN examples e ON e.id = pe.example_id
),
example_mapping_data AS (
    SELECT 
        e.id as example_id,
        e.example as name,
        e.example as description
    FROM params x
    JOIN persona_examples pe ON pe.persona_id = x.persona_id
    JOIN examples e ON e.id = pe.example_id
),
accessible_personas AS (
    SELECT DISTINCT p.id as persona_id
    FROM params x
    JOIN personas p ON true
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
    CROSS JOIN user_profile up
    WHERE (
        up.role = 'superadmin'
        OR pd.department_id IN (SELECT department_id FROM user_departments)
        OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
    )
),
examples_with_departments AS (
    SELECT 
        e.example,
        COALESCE(
            ARRAY_AGG(DISTINCT pd.department_id::text) FILTER (
                WHERE pd.department_id IS NOT NULL
            ),
            ARRAY[]::text[]
        ) as department_ids
    FROM persona_examples pe
    JOIN examples e ON e.id = pe.example_id
    JOIN accessible_personas ap ON ap.persona_id = pe.persona_id
    LEFT JOIN persona_departments pd ON pd.persona_id = pe.persona_id AND pd.active = true
    WHERE e.example IS NOT NULL AND e.example != ''
    GROUP BY e.example
),
examples_history_data AS (
    SELECT COALESCE(
        (
            SELECT ARRAY_AGG(
                (example, department_ids)::types.q_get_persona_detail_v3_example_history_item
                ORDER BY example
            )
            FROM examples_with_departments
        ),
        '{}'::types.q_get_persona_detail_v3_example_history_item[]
    ) as examples_history
),
permissions_data AS (
    SELECT 
        pd.department_ids,
        ud.usage_count,
        up.role as user_role,
        CASE 
            WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN ud.usage_count > 0 THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        true as can_duplicate,
        CASE 
            WHEN pd.department_ids IS NULL AND up.role != 'superadmin' THEN false
            WHEN ud.usage_count > 0 THEN false
            WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM persona_data pd
    CROSS JOIN usage_data ud
    CROSS JOIN user_profile up
)
SELECT 
    (SELECT persona_exists FROM persona_exists_check) as persona_exists,
    pd.name,
    pd.description,
    pd.department_ids,
    pd.active,
    pd.color,
    pd.icon,
    pd.instructions,
    CASE WHEN COALESCE(ud.usage_count, 0) > 0 THEN true ELSE false END as in_use,
    COALESCE(ud.usage_count, 0) as scenario_count,
    perm.can_edit,
    perm.can_duplicate,
    perm.can_delete,
    COALESCE(vdid.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(vaid.valid_agent_ids, ARRAY[]::uuid[]) as valid_agent_ids,
    COALESCE(vpid.valid_parameter_ids, ARRAY[]::uuid[]) as valid_parameter_ids,
    COALESCE(vpiid.valid_parameter_item_ids, ARRAY[]::uuid[]) as valid_parameter_item_ids,
    COALESCE(lpid.linked_parameter_ids, ARRAY[]::uuid[]) as linked_parameter_ids,
    COALESCE(pfid.parameter_field_ids, ARRAY[]::uuid[]) as parameter_field_ids,
    COALESCE(ped.example_ids, ARRAY[]::uuid[]) as example_ids,
    up.actor_name::text as actor_name,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_get_persona_detail_v3_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_get_persona_detail_v3_department[]
    ) as departments,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_get_persona_detail_v3_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_get_persona_detail_v3_agent[]
    ) as agents,
    -- Aggregate parameters separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pmd.parameter_id, pmd.name, pmd.description, pmd.numerical, 
             pmd.document_parameter, pmd.persona_parameter, pmd.scenario_parameter, pmd.video_parameter)::types.q_get_persona_detail_v3_parameter
            ORDER BY pmd.name
        ) FROM parameter_mapping_data pmd),
        '{}'::types.q_get_persona_detail_v3_parameter[]
    ) as parameters,
    -- Aggregate fields separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (fmd.field_id, fmd.name, fmd.description, fmd.parameter_id, fmd.parameter_name)::types.q_get_persona_detail_v3_field
            ORDER BY fmd.name
        ) FROM field_mapping_data fmd),
        '{}'::types.q_get_persona_detail_v3_field[]
    ) as fields,
    -- Aggregate examples separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (emd.example_id, emd.name, emd.description)::types.q_get_persona_detail_v3_example
            ORDER BY emd.name
        ) FROM example_mapping_data emd),
        '{}'::types.q_get_persona_detail_v3_example[]
    ) as examples,
    COALESCE((SELECT examples_history FROM examples_history_data), '{}'::types.q_get_persona_detail_v3_example_history_item[]) as examples_history
FROM persona_data pd
CROSS JOIN usage_data ud
CROSS JOIN user_profile up
CROSS JOIN permissions_data perm
CROSS JOIN valid_department_ids_data vdid
CROSS JOIN valid_agent_ids_data vaid
CROSS JOIN valid_parameter_ids_data vpid
CROSS JOIN valid_parameter_item_ids_data vpiid
CROSS JOIN linked_parameter_ids_data lpid
CROSS JOIN parameter_field_ids_data pfid
CROSS JOIN persona_examples_data ped
CROSS JOIN examples_history_data ehd
$$;

COMMIT;
