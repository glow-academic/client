-- List prompts with department relationships, agent relationships, persona relationships, and permissions
-- Parameters: $1=profileId
WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
prompt_departments_data AS (
    SELECT 
        pd.prompt_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM prompt_departments pd
    WHERE pd.active = true
    GROUP BY pd.prompt_id
),
prompt_agents_data AS (
    SELECT 
        ap.prompt_id,
        ARRAY_AGG(ap.agent_id::text ORDER BY a.name) as agent_ids
    FROM agent_prompts ap
    JOIN agents a ON a.id = ap.agent_id
    WHERE ap.active = true AND a.active = true
    GROUP BY ap.prompt_id
),
prompt_personas_data AS (
    SELECT 
        pr.id as prompt_id,
        ARRAY[]::text[] as persona_ids
    FROM prompts pr
    GROUP BY pr.id
),
prompt_data AS (
    SELECT 
        pr.id as prompt_id,
        pr.name,
        pr.description,
        LEFT(pr.system_prompt, 100) as system_prompt_preview,
        pr.system_prompt,
        pr.active,
        pr.created_at,
        pr.updated_at,
        COALESCE(pdd.department_ids, NULL) as department_ids,
        COALESCE(pad.agent_ids, ARRAY[]::text[]) as agent_ids,
        COALESCE(ppd.persona_ids, ARRAY[]::text[]) as persona_ids,
        CASE 
            -- Default prompts (no department_ids) are read-only for non-superadmin
            WHEN COALESCE(pdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                COUNT(pd.prompt_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM prompt_departments pd2 WHERE pd2.prompt_id = pr.id AND pd2.active = true)
            ) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit
            WHEN COALESCE(pdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                COUNT(pd.prompt_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM prompt_departments pd2 WHERE pd2.prompt_id = pr.id AND pd2.active = true)
            ) THEN true
            ELSE false
        END as can_delete
    FROM prompts pr
    LEFT JOIN prompt_departments pd ON pd.prompt_id = pr.id AND pd.active = true
    LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = pr.id
    LEFT JOIN prompt_agents_data pad ON pad.prompt_id = pr.id
    LEFT JOIN prompt_personas_data ppd ON ppd.prompt_id = pr.id
    CROSS JOIN user_profile up
    GROUP BY pr.id, pr.name, pr.description, pr.system_prompt, pr.active, pr.created_at, pr.updated_at, pdd.department_ids, pad.agent_ids, ppd.persona_ids, up.role
    HAVING 
        -- Include prompts with matching department links OR default prompts (no department links)
        COUNT(pd.prompt_id) FILTER (WHERE pd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM prompt_departments pd2 WHERE pd2.prompt_id = pr.id AND pd2.active = true)
        OR up.role = 'superadmin'
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM prompt_departments_data
    WHERE department_ids IS NOT NULL
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
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
),
all_agent_ids AS (
    SELECT DISTINCT unnest(agent_ids)::uuid as agent_id
    FROM prompt_agents_data
    WHERE agent_ids IS NOT NULL
),
agent_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            a.id::text,
            jsonb_build_object(
                'name', a.name,
                'description', COALESCE(a.description, ''),
                'role', a.role::text
            )
        ) FILTER (WHERE a.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM agents a
    WHERE a.id IN (SELECT agent_id FROM all_agent_ids)
),
all_persona_ids AS (
    SELECT DISTINCT unnest(persona_ids)::uuid as persona_id
    FROM prompt_personas_data
    WHERE persona_ids IS NOT NULL
),
persona_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', COALESCE(p.description, ''),
                'color', p.color,
                'icon', p.icon
            )
        ) FILTER (WHERE p.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM personas p
    WHERE p.id IN (SELECT persona_id FROM all_persona_ids)
),
-- Build facet options for filters
department_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', d.id::text,
                'label', d.title
            ) ORDER BY d.title
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
    ) as options
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
),
agent_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', a.id::text,
                'label', a.name
            ) ORDER BY a.name
        ) FILTER (WHERE a.id IS NOT NULL),
        '[]'::jsonb
    ) as options
    FROM agents a
    WHERE a.id IN (SELECT agent_id FROM all_agent_ids)
),
persona_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', p.id::text,
                'label', p.name
            ) ORDER BY p.name
        ) FILTER (WHERE p.id IS NOT NULL),
        '[]'::jsonb
    ) as options
    FROM personas p
    WHERE p.id IN (SELECT persona_id FROM all_persona_ids)
)
SELECT 
    pd.*,
    dmd.mapping as department_mapping,
    amd.mapping as agent_mapping,
    pmd.mapping as persona_mapping,
    dod.options as department_options,
    aod.options as agent_options,
    pod.options as persona_options
FROM prompt_data pd
CROSS JOIN department_mapping_data dmd
CROSS JOIN agent_mapping_data amd
CROSS JOIN persona_mapping_data pmd
CROSS JOIN department_options_data dod
CROSS JOIN agent_options_data aod
CROSS JOIN persona_options_data pod
ORDER BY pd.updated_at DESC

