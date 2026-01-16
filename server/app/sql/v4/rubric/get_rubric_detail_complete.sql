-- Get rubric detail with departments, standard groups, and access control
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
        WHERE proname = 'api_get_rubric_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_rubric_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_rubric_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_rubric_detail_v4_standard AS (
    standard_id uuid,
    name text,
    description text,
    points int
);

CREATE TYPE types.q_get_rubric_detail_v4_standard_group AS (
    standard_group_id uuid,
    name text,
    description text,
    points int,
    pass_points int,
    position int,
    active boolean,
    standard_ids uuid[]
);

CREATE TYPE types.q_get_rubric_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_rubric_detail_v4_agent AS (
    agent_id uuid,
    name text,
    description text,
    roles text[]
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_rubric_detail_v4(
    rubric_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    rubric_exists boolean,
    rubric_id uuid,
    name text,
    description text,
    department_ids text[],
    valid_department_ids text[],
    points int,
    pass_points int,
    active boolean,
    can_edit boolean,
    valid_agent_ids text[],
    actor_name text,
    standard_group_ids uuid[],
    standard_groups types.q_get_rubric_detail_v4_standard_group[],
    standards types.q_get_rubric_detail_v4_standard[],
    departments types.q_get_rubric_detail_v4_department[],
    agents types.q_get_rubric_detail_v4_agent[],
    draft_version int,
    draft_standard_groups jsonb,
    draft_standards jsonb,
    draft_grid_cells jsonb
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT rubric_id AS rubric_id, profile_id AS profile_id, draft_id AS draft_id
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
rubric_exists_check AS (
    SELECT EXISTS(
        SELECT 1 FROM rubric_artifact WHERE id = (SELECT rubric_id FROM params)
    )::boolean as rubric_exists
),
rubric_data AS (
    SELECT 
        r.id as rubric_id,
        (SELECT n.name FROM rubric_names rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
        (SELECT d.description FROM rubric_descriptions rd JOIN descriptions_resource d ON rd.description_id = d.id WHERE rd.rubric_id = r.id LIMIT 1),
        EXISTS (SELECT 1 FROM rubric_flags rf JOIN flags_resource f ON rf.flag_id = f.id WHERE rf.rubric_id = r.id AND f.name = 'active' AND rf.value = TRUE) as active,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'total'::type_rubric_points LIMIT 1) as points,
        (SELECT p.value FROM rubric_points rp JOIN points_resource p ON rp.point_id = p.id WHERE rp.rubric_id = r.id AND rp.type = 'pass'::type_rubric_points LIMIT 1) as pass_points
    FROM rubric_artifact r
    WHERE r.id = (SELECT rubric_id FROM params)
),
rubric_departments_data AS (
    SELECT 
        ARRAY_AGG(rd.department_id::text ORDER BY rd.created_at) as department_ids
    FROM rubric_departments rd
    WHERE rd.rubric_id = (SELECT rubric_id FROM params) AND rd.active = true
),
user_departments AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
valid_depts AS (
    SELECT 
        array_agg(d.id::text ORDER BY (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)) as dept_ids
    FROM department_artifact d
    JOIN params x ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = x.profile_id AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.id AND f.name = 'active' AND df.value = true)
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as user_role,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
profile_data AS (
    SELECT user_role FROM user_profile
),
user_has_rubric_access AS (
    SELECT EXISTS(
        SELECT 1 FROM rubric_departments rd
        JOIN params x ON true
        JOIN profile_departments pd ON pd.department_id = rd.department_id
        WHERE rd.rubric_id = x.rubric_id AND rd.active = true
        AND pd.profile_id = x.profile_id AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profile_artifact p ON p.id = x.profile_id
        WHERE EXISTS (
            SELECT 1 FROM profile_roles pr_j 
            JOIN roles_resource r ON pr_j.role_id = r.id 
            WHERE pr_j.profile_id = p.id 
            AND r.role = 'superadmin'::profile_role
        )
    ) OR (
        SELECT COUNT(*) FROM rubric_departments rd
        WHERE rd.rubric_id = (SELECT rubric_id FROM params) AND rd.active = true
    ) = 0 as has_access
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
        rsg.position,
        rsg.active,
        ARRAY_AGG(s.id ORDER BY (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)) as standard_ids
    FROM rubric_standard_groups rsg
    JOIN standard_groups_resource sg ON sg.id = rsg.standard_group_id
    LEFT JOIN standards s ON s.standard_group_id = sg.id
    WHERE rsg.rubric_id = (SELECT rubric_id FROM params) AND rsg.active = true
    GROUP BY sg.id, sg.name, sg.description, sg.points, sg.pass_points, rsg.position, rsg.active
),
standard_groups_aggregated AS (
    SELECT 
        ARRAY_AGG(sg.standard_group_id ORDER BY sg.position, sg.name) as standard_group_ids,
        COALESCE(
            ARRAY_AGG(
                (sg.standard_group_id, sg.name, COALESCE(sg.description, ''), sg.points, sg.pass_points, sg.position, sg.active, COALESCE(sg.standard_ids, ARRAY[]::uuid[]))::types.q_get_rubric_detail_v4_standard_group
                ORDER BY sg.position, sg.name
            ),
            '{}'::types.q_get_rubric_detail_v4_standard_group[]
        ) as standard_groups
    FROM standard_groups_data sg
),
standards_distinct AS (
    SELECT DISTINCT ON (s.id)
        s.id, (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1), COALESCE((SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions_resource d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM scenario_descriptions sd JOIN descriptions_resource d ON sd.description_id = d.id WHERE sd.scenario_id = s.id LIMIT 1), '') as description, s.points
    FROM standards s
    WHERE s.standard_group_id IN (SELECT standard_group_id FROM standard_groups_data)
    ORDER BY s.id, (SELECT n.name FROM scenario_names sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.scenario_id = s.id LIMIT 1)
),
standards_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (sd.id, sd.name, sd.description, sd.points)::types.q_get_rubric_detail_v4_standard
                ORDER BY sd.name
            ),
            '{}'::types.q_get_rubric_detail_v4_standard[]
        ) as standards
    FROM standards_distinct sd
),
departments_distinct AS (
    SELECT DISTINCT ON (d.id)
        d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1), COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1), '') as description
    FROM department_artifact d
    WHERE d.id IN (SELECT department_id FROM user_departments)
    ORDER BY d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1)
),
departments_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                (dd.id, dd.name, dd.description)::types.q_get_rubric_detail_v4_department
                ORDER BY dd.name
            ),
            '{}'::types.q_get_rubric_detail_v4_department[]
        ) as departments
    FROM departments_distinct dd
),
valid_agents_data AS (
    SELECT 
        agents_table.id as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = agents_table.id LIMIT 1) as name,
        COALESCE((SELECT desc_text.description FROM agent_descriptions adesc JOIN descriptions_resource desc_text ON adesc.description_id = desc_text.id WHERE adesc.agent_id = agents_table.id LIMIT 1), '') as description,
        ARRAY[COALESCE(NULL::artifacts::text, '')] as roles
    FROM agent_artifact agents_table
    
    
    LEFT JOIN agent_departments ad ON NULL::uuid = agents_table.id AND ad.active = true
    CROSS JOIN rubric_data rd
    WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = agents_table.id AND f.name = 'active' AND af.value = true)
    AND (
        EXISTS (
            SELECT 1 FROM agent_departments ad2 
            WHERE ad2.agent_id = agents_table.id 
            AND ad2.active = true 
            AND ad2.department_id IN (SELECT department_id FROM user_departments_for_agents)
        )
        OR NOT EXISTS (
            SELECT 1 FROM agent_departments ad3 
            WHERE ad3.agent_id = agents_table.id 
            AND ad3.active = true
        )
        -- Domain check removed - no longer needed
    )
),
agents_aggregated AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(vad.agent_id::text ORDER BY vad.name),
            ARRAY[]::text[]
        ) as valid_agent_ids,
        COALESCE(
            ARRAY_AGG(
                (vad.agent_id, vad.name, vad.description, vad.roles)::types.q_get_rubric_detail_v4_agent
                ORDER BY vad.name
            ),
            '{}'::types.q_get_rubric_detail_v4_agent[]
        ) as agents
    FROM valid_agents_data vad
)
SELECT 
    rec.rubric_exists,
    rd.rubric_id,
    -- Merge draft payload with rubric data (draft takes precedence)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        rd.name::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        rd.description::text
    ) as description,
    COALESCE(rdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(vd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    rd.points,
    rd.pass_points,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        rd.active::boolean
    ) as active,
    CASE 
        WHEN (COALESCE(rdd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND pr.user_role != 'superadmin') THEN false
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role IN ('admin', 'instructional') AND uhra.has_access THEN true
        ELSE false
    END as can_edit,
    COALESCE(aa.valid_agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    up.actor_name,
    COALESCE(sga.standard_group_ids, ARRAY[]::uuid[]) as standard_group_ids,
    sga.standard_groups,
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
FROM rubric_exists_check rec
CROSS JOIN rubric_data rd
LEFT JOIN rubric_departments_data rdd ON true
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN user_profile up
CROSS JOIN standard_groups_aggregated sga
CROSS JOIN standards_aggregated sta
CROSS JOIN departments_aggregated da
CROSS JOIN user_has_rubric_access uhra
CROSS JOIN agents_aggregated aa
LEFT JOIN draft_payload_data ON true
WHERE uhra.has_access = true OR rec.rubric_exists = false
$$;