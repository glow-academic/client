-- Get prompt detail with department relationships, agent relationships, persona relationships, and permissions
-- Parameters: $1=promptId (uuid), $2=profileId (uuid)
WITH resolve_profile_id AS (
    SELECT $2::uuid as resolved_profile_id
),
prompt_data AS (
    SELECT 
        pr.id as prompt_id,
        pr.name,
        pr.description,
        pr.system_prompt,
        pr.active,
        pr.created_at,
        pr.updated_at
    FROM prompts pr
    WHERE pr.id = $1::uuid
),
prompt_departments_data AS (
    SELECT 
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM prompt_departments pd
    WHERE pd.prompt_id = $1::uuid AND pd.active = true
),
prompt_agents_data AS (
    SELECT 
        ARRAY_AGG(ap.agent_id::text ORDER BY a.name) as agent_ids
    FROM agent_prompts ap
    JOIN agents a ON a.id = ap.agent_id
    WHERE ap.prompt_id = $1::uuid AND ap.active = true AND a.active = true
),
prompt_personas_data AS (
    SELECT 
        ARRAY[]::text[] as persona_ids
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM departments d
    CROSS JOIN resolve_profile_id rpi
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true AND pd.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
user_has_prompt_access AS (
    -- Check if user has access to prompt via department links
    SELECT EXISTS(
        SELECT 1 FROM prompt_departments pd
        CROSS JOIN resolve_profile_id rpi
        JOIN profile_departments pdp ON pdp.department_id = pd.department_id
        WHERE pd.prompt_id = $1::uuid AND pd.active = true
        AND pdp.profile_id = rpi.resolved_profile_id AND pdp.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default prompts (no department links) are accessible to all admins
        SELECT COUNT(*) FROM prompt_departments pd
        WHERE pd.prompt_id = $1::uuid AND pd.active = true
    ) = 0 as has_access
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
    FROM agent_prompts ap
    JOIN agents a ON a.id = ap.agent_id
    WHERE ap.prompt_id = $1::uuid AND ap.active = true AND a.active = true
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
    FROM prompts pr
    CROSS JOIN personas p ON false
    WHERE pr.id = $1::uuid AND false
)
SELECT 
    pd.*,
    COALESCE(pdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(paad.agent_ids, ARRAY[]::text[]) as agent_ids,
    COALESCE(pppd.persona_ids, ARRAY[]::text[]) as persona_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    amd.mapping as agent_mapping,
    pmd.mapping as persona_mapping,
    CASE 
        -- Default prompts (no department_ids) are read-only for non-superadmin
        WHEN (COALESCE(pdd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND pr.user_role != 'superadmin') THEN false
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND uhpa.has_access THEN true
        ELSE false
    END as can_edit
FROM prompt_data pd
CROSS JOIN prompt_departments_data pdd
CROSS JOIN prompt_agents_data paad
CROSS JOIN prompt_personas_data pppd
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN user_has_prompt_access uhpa
CROSS JOIN agent_mapping_data amd
CROSS JOIN persona_mapping_data pmd
WHERE uhpa.has_access = true

