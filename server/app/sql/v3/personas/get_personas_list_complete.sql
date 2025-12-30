-- Get personas list with permissions and scenario details
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
        WHERE proname = 'api_list_personas_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_list_personas_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_list_personas_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_list_personas_v3_persona AS (
    persona_id uuid,
    name text,
    description text,
    color text,
    icon text,
    department_ids text[],
    scenario_ids uuid[],
    agent_id uuid,
    agent_name text,
    model_id uuid,
    model_name text,
    reasoning text,
    temperature float,
    temperature_display text,
    active boolean,
    is_inactive boolean,
    num_scenarios int,
    can_edit boolean,
    can_duplicate boolean,
    can_delete boolean,
    updated_at timestamptz
);

CREATE TYPE types.q_list_personas_v3_scenario AS (
    scenario_id uuid,
    name text,
    description text,
    active boolean,
    persona_ids uuid[],
    document_ids uuid[],
    parameter_item_ids uuid[]
);

CREATE TYPE types.q_list_personas_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

CREATE TYPE types.q_list_personas_v3_department AS (
    department_id uuid,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_list_personas_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    personas types.q_list_personas_v3_persona[],
    scenarios types.q_list_personas_v3_scenario[],
    agents types.q_list_personas_v3_agent[],
    departments types.q_list_personas_v3_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
user_profile AS (
    SELECT 
        role,
        first_name || ' ' || last_name as actor_name
    FROM params x
    JOIN profiles ON profiles.id = x.profile_id
),
persona_active_scenario_links AS (
    SELECT 
        sp.persona_id,
        COUNT(*) as active_scenario_count
    FROM scenario_personas sp
    WHERE sp.active = true
    GROUP BY sp.persona_id
),
persona_all_scenario_links AS (
    SELECT 
        sp.persona_id,
        COUNT(*) as total_scenario_links
    FROM scenario_personas sp
    GROUP BY sp.persona_id
),
persona_scenarios AS (
    SELECT 
        sp.persona_id,
        ARRAY_AGG(DISTINCT st.parent_id) as scenario_ids,
        COUNT(DISTINCT st.parent_id) as num_scenarios
    FROM scenario_personas sp
    JOIN scenario_tree st ON st.child_id = sp.scenario_id
    WHERE sp.active = true AND st.parent_id = st.child_id
    GROUP BY sp.persona_id
),
persona_departments_data AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    WHERE pd.active = true
    GROUP BY pd.persona_id
),
persona_data_base AS (
    SELECT 
        p.id as persona_id,
        p.name as persona_name,
        p.description,
        p.color,
        p.icon,
        NULL::uuid as agent_id,
        NULL::uuid as model_id,
        NULL::text as reasoning,
        NULL::numeric as temperature,
        p.active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(ps.num_scenarios, 0) as num_scenarios,
        COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
        COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
        CASE WHEN COUNT(pd.persona_id) > 0 THEN true ELSE false END as has_dept_links
    FROM personas p
    LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
    LEFT JOIN persona_active_scenario_links pasl ON pasl.persona_id = p.id
    LEFT JOIN persona_all_scenario_links pasl_all ON pasl_all.persona_id = p.id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true AND pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY p.id, p.name, p.description, p.color, p.icon, p.active, p.updated_at, 
             pdd.department_ids, ps.scenario_ids, ps.num_scenarios, pasl.active_scenario_count, pasl_all.total_scenario_links
    HAVING COUNT(pd.persona_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true
    )
),
persona_data AS (
    SELECT 
        pdb.*,
        CASE 
            WHEN pdb.active_scenario_count > 0 THEN false
            WHEN NOT pdb.has_dept_links AND up.role != 'superadmin' THEN false
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_edit,
        CASE 
            WHEN NOT pdb.has_dept_links AND up.role != 'superadmin' THEN false
            WHEN pdb.total_scenario_links > 0 THEN false
            WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role, 'superadmin'::profile_role) THEN true
            ELSE false
        END as can_delete
    FROM persona_data_base pdb
    CROSS JOIN user_profile up
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM persona_data
),
scenario_department_check AS (
    SELECT DISTINCT sd.scenario_id::text
    FROM scenario_departments sd
    WHERE sd.scenario_id::text = ANY(SELECT scenario_id::text FROM all_scenario_ids)
    AND sd.department_id::text = ANY(SELECT department_id::text FROM user_departments)
    AND sd.active = true
    UNION
    SELECT DISTINCT s.id::text
    FROM scenarios s
    WHERE s.id::text = ANY(SELECT scenario_id::text FROM all_scenario_ids)
    AND NOT EXISTS (
        SELECT 1 FROM scenario_departments sd2 
        WHERE sd2.scenario_id = s.id AND sd2.active = true
    )
),
valid_scenario_ids AS (
    SELECT scenario_id::uuid
    FROM scenario_department_check
),
scenario_mapping_data AS (
    SELECT 
        s.id as scenario_id,
        s.name,
        COALESCE(ps.problem_statement, '') as description,
        s.active,
        ARRAY[]::uuid[] as persona_ids,
        ARRAY[]::uuid[] as document_ids,
        ARRAY[]::uuid[] as parameter_item_ids
    FROM all_scenario_ids asi
    JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
),
department_mapping_data AS (
    SELECT 
        d.id as department_id,
        d.title as name,
        COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
),
assigned_agent_ids AS (
    SELECT DISTINCT agent_id
    FROM persona_data
    WHERE agent_id IS NOT NULL
),
agent_mapping_data AS (
    SELECT 
        a.id as agent_id,
        a.name,
        COALESCE(a.description, '') as description,
        ARRAY[a.role::text] as roles
    FROM agents a
    WHERE a.id IN (SELECT agent_id FROM assigned_agent_ids)
    AND a.active = true
)
SELECT 
    up.actor_name::text as actor_name,
    -- Aggregate personas separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (pd.persona_id, pd.persona_name, pd.description, pd.color, pd.icon,
             pd.department_ids, pd.scenario_ids, pd.agent_id, NULL::text,
             pd.model_id, NULL::text, pd.reasoning, 
             COALESCE(pd.temperature, 0.0), 
             CASE WHEN pd.temperature IS NOT NULL THEN TO_CHAR(pd.temperature, 'FM0.00') ELSE '0.00' END,
             pd.active, NOT pd.active, pd.num_scenarios,
             pd.can_edit,
             true,
             pd.can_delete,
             pd.updated_at
            )::types.q_list_personas_v3_persona
            ORDER BY pd.updated_at DESC NULLS LAST
        ) FROM persona_data pd),
        '{}'::types.q_list_personas_v3_persona[]
    ) as personas,
    -- Aggregate scenarios separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (smd.scenario_id, smd.name, smd.description, smd.active, smd.persona_ids, 
             smd.document_ids, smd.parameter_item_ids)::types.q_list_personas_v3_scenario
            ORDER BY smd.name
        ) FROM scenario_mapping_data smd),
        '{}'::types.q_list_personas_v3_scenario[]
    ) as scenarios,
    -- Aggregate agents separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (amd.agent_id, amd.name, amd.description, amd.roles)::types.q_list_personas_v3_agent
            ORDER BY amd.name
        ) FROM agent_mapping_data amd),
        '{}'::types.q_list_personas_v3_agent[]
    ) as agents,
    -- Aggregate departments separately
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description)::types.q_list_personas_v3_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd),
        '{}'::types.q_list_personas_v3_department[]
    ) as departments
FROM user_profile up
$$;

COMMIT;
