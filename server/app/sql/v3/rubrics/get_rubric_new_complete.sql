-- Get default rubric detail for creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_rubric_new_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_new_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_rubric_new_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse detail types where possible, but create new ones for clarity)
CREATE TYPE types.q_get_rubric_new_v3_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubric_new_v3_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standard_ids uuid[]
);

CREATE TYPE types.q_get_rubric_new_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_rubric_new_v3_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_new_v3(profile_id uuid)
RETURNS TABLE (
    name text,
    description text,
    department_ids text[],
    valid_department_ids text[],
    points int,
    pass_points int,
    active boolean,
    can_edit boolean,
    rubric_agent_id uuid,
    valid_agent_ids text[],
    actor_name text,
    user_role text,
    primary_department_id uuid,
    standard_group_ids uuid[],
    standard_groups types.q_get_rubric_new_v3_standard_group[],
    standards types.q_get_rubric_new_v3_standard[],
    departments types.q_get_rubric_new_v3_department[],
    agents types.q_get_rubric_new_v3_agent[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        role as user_role,
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.active = true
),
default_rubric AS (
    SELECT r.id
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    WHERE r.active = true
    GROUP BY r.id
    HAVING 
        COUNT(rd.rubric_id) FILTER (WHERE rd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
    ORDER BY r.created_at DESC
    LIMIT 1
),
rubric_data AS (
    SELECT 
        ''::text as name,
        ''::text as description,
        r.active,
        r.points,
        r.pass_points
    FROM rubrics r
    JOIN default_rubric dr ON r.id = dr.id
),
rubric_departments_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) FILTER (WHERE rd.department_id IS NOT NULL),
            ARRAY[]::text[]
        ) as department_ids
    FROM default_rubric dr
    LEFT JOIN rubric_departments rd ON rd.rubric_id = dr.id AND rd.active = true
    GROUP BY dr.id
),
valid_depts AS (
    SELECT 
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM departments d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND d.active = true
),
primary_department_id AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
user_departments_for_agents AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    JOIN params x ON pd.profile_id = x.profile_id
    WHERE pd.active = true
),
standard_groups_data AS (
    SELECT 
        sg.id as standard_group_id,
        sg.name,
        sg.description,
        sg.points,
        sg.pass_points,
        sg.position,
        sg.active,
        ARRAY_AGG(s.id ORDER BY s.name) as standard_ids
    FROM standard_groups sg
    LEFT JOIN standards s ON s.standard_group_id = sg.id
    JOIN default_rubric dr ON sg.rubric_id = dr.id
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, sg.position, sg.active
),
standard_groups_aggregated AS (
    SELECT 
        ARRAY_AGG(sg.standard_group_id ORDER BY sg.position, sg.name) as standard_group_ids,
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]))::types.q_get_rubric_new_v3_standard_group
                ORDER BY sg.position, sg.name
            ),
            '{}'::types.q_get_rubric_new_v3_standard_group[]
        ) as standard_groups
    FROM standard_groups_data sg
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, s.name, COALESCE(s.description, '') as description, s.points
    FROM standards s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM standard_groups_data)
    ORDER BY s.id, s.name
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.name, sd.description, sd.points)::types.q_get_rubric_new_v3_standard
                ORDER BY sd.name
            ),
            '{}'::types.q_get_rubric_new_v3_standard[]
        ) as standards
    FROM standards_distinct sd
),
departments_distinct AS (
    SELECT DISTINCT ON (d.id)
        d.id, d.title, COALESCE(d.description, '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
    ORDER BY d.id, d.title
),
departments_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.title, dd.description)::types.q_get_rubric_new_v3_department
                ORDER BY dd.title
            ),
            '{}'::types.q_get_rubric_new_v3_department[]
        ) as departments
    FROM departments_distinct dd
),
valid_agents_data AS (
    SELECT 
        a.id as agent_id,
        a.name,
        a.description,
        ARRAY[a.role::text] as roles
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role = 'rubric'
    AND (
        EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = a.id 
            AND ad2.active = true 
            AND ad2.department_id IN (SELECT department_id FROM user_departments_for_agents)
        )
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad3 
            WHERE ad3.agent_id = a.id 
            AND ad3.active = true
        )
    )
),
agents_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(a.agent_id::text ORDER BY a.name),
            ARRAY[]::text[]
        ) as valid_agent_ids,
        COALESCE(
            ARRAY_AGG(
                (a.agent_id, a.name, COALESCE(a.description, ''), a.roles)::types.q_get_rubric_new_v3_agent
                ORDER BY a.name
            ),
            '{}'::types.q_get_rubric_new_v3_agent[]
        ) as agents
    FROM valid_agents_data a
)
SELECT 
    rd.name,
    rd.description,
    COALESCE(rdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    rd.points,
    rd.pass_points,
    rd.active,
    CASE 
        WHEN up.user_role = 'superadmin' THEN true
        WHEN up.user_role IN ('admin', 'instructional') THEN true
        ELSE false
    END as can_edit,
    NULL::uuid as rubric_agent_id,
    COALESCE(aa.valid_agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    up.actor_name,
    up.user_role,
    pdi.department_id as primary_department_id,
    COALESCE(sga.standard_group_ids, ARRAY[]::uuid[]) as standard_group_ids,
    sga.standard_groups,
    sta.standards,
    da.departments,
    aa.agents
FROM rubric_data rd
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN valid_depts vd
CROSS JOIN user_profile up
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
CROSS JOIN departments_aggregated da
LEFT JOIN primary_department_id pdi ON true
CROSS JOIN agents_aggregated aa
$$;

COMMIT;
