-- Get default rubric detail for creation
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_rubric_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubric_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types (reuse detail types where possible, but create new ones for clarity)
CREATE TYPE types.q_get_rubric_new_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubric_new_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standard_ids uuid[]
);

CREATE TYPE types.q_get_rubric_new_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_rubric_new_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
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
    standard_groups types.q_get_rubric_new_v4_standard_group[],
    standards types.q_get_rubric_new_v4_standard[],
    departments types.q_get_rubric_new_v4_department[],
    agents types.q_get_rubric_new_v4_agent[],
    draft_version int,
    draft_standard_groups jsonb,
    draft_standards jsonb,
    draft_grid_cells jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id, draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'rubrics'::draft_resource_type
    LIMIT 1
),
user_profile AS (
    SELECT 
        role as user_role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.active = true
),
rubric_data AS (
    SELECT 
        ''::text as name,
        ''::text as description,
        true::boolean as active,
        0::int as points,
        0::int as pass_points
    FROM params x
    LIMIT 1
),
rubric_departments_data AS (
    SELECT 
        ARRAY[]::text[] as department_ids
    FROM params x
    LIMIT 1
),
valid_depts AS (
    SELECT 
        array_agg(d.id::text ORDER BY (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as dept_ids
    FROM departments d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
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
        NULL::uuid as standard_group_id,
        NULL::text as name,
        NULL::text as description,
        NULL::int as points,
        NULL::int as pass_points,
        NULL::int as position,
        NULL::boolean as active,
        NULL::uuid[] as standard_ids
    FROM params x
    WHERE false
),
standard_groups_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(sg.standard_group_id ORDER BY sg.position, sg.name) FILTER (WHERE sg.standard_group_id IS NOT NULL),
            ARRAY[]::uuid[]
        ) as standard_group_ids,
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]))::types.q_get_rubric_new_v4_standard_group
                ORDER BY sg.position, sg.name
            ) FILTER (WHERE sg.standard_group_id IS NOT NULL),
            '{}'::types.q_get_rubric_new_v4_standard_group[]
        ) as standard_groups
    FROM standard_groups_data sg
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description, s.points
    FROM standards s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM standard_groups_data)
    ORDER BY s.id, (SELECT n.name FROM scenario_names sn JOIN names n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.name, sd.description, sd.points)::types.q_get_rubric_new_v4_standard
                ORDER BY sd.name
            ),
            '{}'::types.q_get_rubric_new_v4_standard[]
        ) as standards
    FROM standards_distinct sd
),
departments_distinct AS (
    SELECT DISTINCT ON (d.id)
        d.id, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as title, COALESCE((SELECT d_desc.description FROM department_descriptions dd JOIN descriptions d_desc ON d_desc.id = dd.description_id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
    ORDER BY d.id, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
),
departments_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.title, dd.description)::types.q_get_rubric_new_v4_department
                ORDER BY dd.title
            ),
            '{}'::types.q_get_rubric_new_v4_department[]
        ) as departments
    FROM departments_distinct dd
),
valid_agents_data AS (
    SELECT 
        a.id as agent_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1),
        ARRAY[COALESCE(da.artifact::text, '')] as roles
    FROM agents a
    JOIN agent_domains adom ON adom.agent_id = a.id
    JOIN domain_artifacts da ON da.domain_id = adom.domain_id AND da.artifact = CAST('rubric' AS artifacts)
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags fl ON af.flag_id = fl.id WHERE af.agent_id = a.id AND fl.name = 'active' AND af.type = 'active'::type_agent_flags AND af.value = true)
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
            ARRAY_AGG(a.agent_id::text ORDER BY (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.agent_id LIMIT 1)),
            ARRAY[]::text[]
        ) as valid_agent_ids,
        COALESCE(
            ARRAY_AGG(
                (a.agent_id, (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.agent_id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.agent_id LIMIT 1), ''), a.roles)::types.q_get_rubric_new_v4_agent
                ORDER BY (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.agent_id LIMIT 1)
            ),
            '{}'::types.q_get_rubric_new_v4_agent[]
        ) as agents
    FROM valid_agents_data a
)
SELECT 
    -- Merge draft payload with rubric data (draft takes precedence)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        rd.name::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        rd.description::text
    ) as description,
    COALESCE(
        (SELECT 
            CASE 
                WHEN payload->'department_ids' IS NOT NULL AND jsonb_typeof(payload->'department_ids') = 'array' THEN
                    ARRAY(SELECT jsonb_array_elements_text(payload->'department_ids'))
                ELSE NULL
            END
        FROM draft_payload_data),
        rdd.department_ids,
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(
        (SELECT (payload->>'points')::int FROM draft_payload_data),
        rd.points
    ) as points,
    COALESCE(
        (SELECT (payload->>'pass_points')::int FROM draft_payload_data),
        rd.pass_points
    ) as pass_points,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        rd.active::boolean
    ) as active,
    CASE 
        WHEN up.user_role = 'superadmin' THEN true
        WHEN up.user_role IN ('admin', 'instructional') THEN true
        ELSE false
    END as can_edit,
    COALESCE(
        (SELECT (payload->>'rubricAgentId')::uuid FROM draft_payload_data),
        (SELECT (payload->>'rubric_agent_id')::uuid FROM draft_payload_data),
        NULL::uuid
    ) as rubric_agent_id,
    COALESCE(aa.valid_agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    up.actor_name,
    up.user_role,
    pdi.department_id as primary_department_id,
    sga.standard_group_ids,
    COALESCE(sga.standard_groups, '{}'::types.q_get_rubric_new_v4_standard_group[]) as standard_groups,
    sta.standards,
    da.departments,
    aa.agents,
    -- Draft version (from draft payload if exists)
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version,
    -- Extract standardGroups from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'standardGroups' FROM draft_payload_data),
        (SELECT payload->'standard_groups' FROM draft_payload_data),
        '[]'::jsonb
    ) as draft_standard_groups,
    -- Extract standards from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'standards' FROM draft_payload_data),
        (SELECT payload->'standards' FROM draft_payload_data),
        '[]'::jsonb
    ) as draft_standards,
    -- Extract gridCells from draft payload if available (support both camelCase and snake_case)
    COALESCE(
        (SELECT payload->'gridCells' FROM draft_payload_data),
        (SELECT payload->'grid_cells' FROM draft_payload_data),
        '{}'::jsonb
    ) as draft_grid_cells
FROM rubric_data rd
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN valid_depts vd
CROSS JOIN user_profile up
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
CROSS JOIN departments_aggregated da
LEFT JOIN primary_department_id pdi ON true
CROSS JOIN agents_aggregated aa
LEFT JOIN draft_payload_data ON true
$$;