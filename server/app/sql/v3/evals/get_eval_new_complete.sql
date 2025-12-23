-- Get default eval detail for creation
-- Parameters: $1 = profile_id (uuid)
-- Returns: default eval structure with mappings for departments, agents, rubrics

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
user_departments_for_agents AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_for_rubrics AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_department_ids AS (
    SELECT ARRAY_AGG(id) as ids
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND d.active = true
),
-- Eval agents (agents with 'eval' role - for eval_agent_id picker)
valid_eval_agents_list AS (
    SELECT 
        a.id,
        a.name,
        COALESCE(a.description, '') as description,
        a.role
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true 
    AND a.role = 'eval'
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_eval_agents AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', a.description,
                    'roles', ARRAY[a.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        COALESCE(array_agg(a.id::text ORDER BY a.name), ARRAY[]::text[]) as agent_ids
    FROM valid_eval_agents_list a
),
-- Agents being evaluated (all active agents - for agent_id picker)
valid_agents_for_eval_list AS (
    SELECT 
        a.id,
        a.name,
        COALESCE(a.description, '') as description,
        a.role
    FROM agents a
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    WHERE a.active = true
    GROUP BY a.id, a.name, a.description, a.role
    HAVING 
        COUNT(ad.agent_id) FILTER (WHERE ad.department_id IN (SELECT department_id FROM user_departments_for_agents)) > 0
        OR NOT EXISTS (SELECT 1 FROM agent_departments ad2 WHERE ad2.agent_id = a.id AND ad2.active = true)
),
valid_agents_for_eval AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                a.id::text,
                jsonb_build_object(
                    'name', a.name,
                    'description', a.description,
                    'roles', ARRAY[a.role::text]
                )
            ),
            '{}'::jsonb
        ) as agent_mapping,
        COALESCE(array_agg(a.id::text ORDER BY a.name), ARRAY[]::text[]) as agent_ids
    FROM valid_agents_for_eval_list a
),
-- Valid rubrics (will be filtered by agent role in component)
valid_rubrics_data AS (
    SELECT DISTINCT
        r.id,
        r.name,
        COALESCE(r.description, '') as description,
        r.agent_role::text as agent_role
    FROM rubrics r
    LEFT JOIN rubric_departments rd ON rd.rubric_id = r.id AND rd.active = true
    CROSS JOIN user_department_ids udi
    WHERE r.active = true
      AND (
          rd.department_id = ANY(udi.ids)
          OR NOT EXISTS (SELECT 1 FROM rubric_departments rd2 WHERE rd2.rubric_id = r.id AND rd2.active = true)
      )
),
rubric_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            vr.id::text,
            jsonb_build_object(
                'name', vr.name,
                'description', vr.description,
                'agent_role', vr.agent_role
            )
        ),
        '{}'::jsonb
    ) as rubric_mapping,
    COALESCE(ARRAY_AGG(vr.id::text), ARRAY[]::text[]) as rubric_ids
    FROM valid_rubrics_data vr
),
-- Department mapping
valid_departments AS (
    SELECT DISTINCT d.id, d.title as name, COALESCE(d.description, '') as description
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE pd.profile_id = (SELECT resolved_profile_id FROM resolve_profile_id) AND d.active = true
),
valid_dept_ids AS (
    SELECT ARRAY_AGG(id::text) as ids FROM valid_departments
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.name,
                'description', d.description
            )
        ),
        '{}'::jsonb
    ) as mapping
    FROM valid_departments d
)
SELECT 
    -- Default eval values
    NULL::text as eval_id,
    ''::text as name,
    ''::text as description,
    NULL::text as rubric_id,
    NULL::text as eval_agent_id,
    NULL::text as agent_id,
    NULL::text[] as agent_ids,
    NULL::text[] as model_run_ids,
    true as active,
    false as dynamic,
    NULL::text[] as department_ids,
    COALESCE(vdi.ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(dmd.mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vea.agent_mapping, '{}'::jsonb) as eval_agent_mapping,
    COALESCE(vea.agent_ids, ARRAY[]::text[]) as valid_eval_agent_ids,
    COALESCE(vae.agent_mapping, '{}'::jsonb) as agent_mapping,
    COALESCE(vae.agent_ids, ARRAY[]::text[]) as valid_agent_ids,
    COALESCE(rmd.rubric_mapping, '{}'::jsonb) as rubric_mapping,
    COALESCE(rmd.rubric_ids, ARRAY[]::text[]) as valid_rubric_ids,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_edit,
    CASE 
        WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
        ELSE false
    END as can_delete,
    up.actor_name
FROM user_profile up
CROSS JOIN valid_dept_ids vdi
CROSS JOIN department_mapping_data dmd
CROSS JOIN valid_eval_agents vea
CROSS JOIN valid_agents_for_eval vae
CROSS JOIN rubric_mapping_data rmd

