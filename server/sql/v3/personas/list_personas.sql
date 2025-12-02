WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
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
    -- Join with scenario_tree to get root scenario for each linked scenario
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
persona_agents_data AS (
    SELECT 
        pa.persona_id,
        pa.agent_id,
        a.role,
        a.model_id,
        mrl.reasoning_level as reasoning,
        COALESCE(mtl.temperature, 0.0) as temperature
    FROM persona_agents pa
    JOIN agents a ON a.id = pa.agent_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id AND mtl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id AND mrl.active = true
    WHERE pa.active = true
),
persona_primary_agent AS (
    -- Get primary agent: prefer simulation-text, fallback to simulation-voice
    SELECT DISTINCT ON (pad.persona_id)
        pad.persona_id,
        pad.agent_id,
        pad.model_id,
        pad.reasoning,
        pad.temperature
    FROM persona_agents_data pad
    ORDER BY pad.persona_id, 
             CASE WHEN pad.role = 'simulation-text' THEN 1 ELSE 2 END
),
all_agent_ids AS (
    SELECT DISTINCT agent_id
    FROM persona_agents_data
),
agent_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            jsonb_build_object(
                'name', a.name,
                'description', COALESCE(a.description, ''),
                'roles', ARRAY[a.role]::text[]
            )
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_agent_ids aai
    JOIN agents a ON a.id = aai.agent_id
    WHERE a.active = true
),
persona_data AS (
    SELECT 
        p.id as persona_id,
        p.name as persona_name,
        p.description,
        p.color,
        p.icon,
        ppa.agent_id,
        ppa.model_id,
        ppa.reasoning,
        ppa.temperature,
        p.active,
        p.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(ps.scenario_ids, ARRAY[]::uuid[]) as scenario_ids,
        COALESCE(ps.num_scenarios, 0) as num_scenarios,
        a.name as agent_name,
        COALESCE(a.description, '') as agent_description,
        m.name as model_name,
        COALESCE(m.description, '') as model_description,
        COALESCE(pasl.active_scenario_count, 0) as active_scenario_count,
        COALESCE(pasl_all.total_scenario_links, 0) as total_scenario_links,
        CASE WHEN COUNT(pd.persona_id) > 0 THEN true ELSE false END as has_dept_links
    FROM personas p
    LEFT JOIN persona_scenarios ps ON ps.persona_id = p.id
    LEFT JOIN persona_active_scenario_links pasl ON pasl.persona_id = p.id
    LEFT JOIN persona_all_scenario_links pasl_all ON pasl_all.persona_id = p.id
    LEFT JOIN persona_primary_agent ppa ON ppa.persona_id = p.id
    LEFT JOIN agents a ON a.id = ppa.agent_id
    LEFT JOIN models m ON m.id = ppa.model_id
    LEFT JOIN persona_departments_data pdd ON pdd.persona_id = p.id
    LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true AND pd.department_id IN (SELECT department_id FROM user_departments)
    GROUP BY p.id, p.name, p.description, p.color, p.icon, ppa.agent_id, ppa.model_id, ppa.reasoning, ppa.temperature, p.active, p.updated_at, 
             pdd.department_ids, ps.scenario_ids, ps.num_scenarios, a.name, a.description, m.name, m.description, pasl.active_scenario_count, pasl_all.total_scenario_links
    HAVING COUNT(pd.persona_id) > 0 OR NOT EXISTS (
        SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true
    )
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
all_scenario_ids AS (
    SELECT DISTINCT unnest(scenario_ids) as scenario_id
    FROM persona_data
),
scenario_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            s.id::text,
            jsonb_build_object(
                'name', s.name,
                'description', COALESCE(ps.problem_statement, ''),
                'active', s.active,
                'persona_id', NULL,
                'persona_mapping', '{}'::jsonb,
                'document_mapping', '{}'::jsonb,
                'parameter_item_mapping', '{}'::jsonb,
                'parameter_item_ids', ARRAY[]::text[],
                'document_ids', ARRAY[]::text[]
            )
        ) FILTER (WHERE s.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM all_scenario_ids asi
    LEFT JOIN scenarios s ON s.id = asi.scenario_id
    LEFT JOIN scenario_problem_statements sps ON sps.scenario_id = s.id AND sps.active = true
    LEFT JOIN problem_statements ps ON ps.id = sps.problem_statement_id
    -- Since persona_scenarios already resolved to root scenarios,
    -- all IDs here should be roots (parent_id = child_id)
    LEFT JOIN scenario_tree st ON st.parent_id = s.id AND st.child_id = s.id
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM user_departments)
)
SELECT 
    pd.persona_id,
    pd.persona_name,
    pd.description,
    pd.color,
    pd.icon,
    pd.agent_id,
    pd.model_id,
    pd.reasoning,
    pd.temperature,
    pd.active,
    pd.scenario_ids,
    pd.num_scenarios,
    pd.agent_name,
    pd.agent_description,
    pd.model_name,
    pd.model_description,
    CASE 
        WHEN pd.active_scenario_count > 0 THEN false
        WHEN NOT pd.has_dept_links AND up.role != 'superadmin' THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    true as can_duplicate,
    CASE 
        -- Can't delete if can't edit (stricter than can_edit)
        WHEN NOT pd.has_dept_links AND up.role != 'superadmin' THEN false
        WHEN pd.total_scenario_links > 0 THEN false
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    sm.mapping as scenario_mapping,
    am.mapping as agent_mapping,
    dm.mapping as department_mapping
FROM persona_data pd
CROSS JOIN user_profile up
CROSS JOIN scenario_mapping_data sm
CROSS JOIN agent_mapping_data am
CROSS JOIN department_mapping_data dm
ORDER BY pd.updated_at DESC NULLS LAST
