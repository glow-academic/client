-- Get agent detail with prompts, departments, and access control
-- Parameters: $1 = agent_id (uuid), $2 = profile_id (uuid or "guest-profile-id")

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
agent_info AS (
    SELECT 
        id::text as agent_id,
        name,
        description,
        temperature,
        model_id::text,
        reasoning,
        active,
        role::text
    FROM agents
    WHERE id = $1::uuid
),
agent_active_prompt AS (
    SELECT 
        ap.agent_id::text as agent_id,
        ap.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid AND ap.active = true
    LIMIT 1
),
agent_all_prompts AS (
    -- Get all prompts from agent_prompts (default prompts)
    SELECT 
        ap.agent_id::text as agent_id,
        ap.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.name as prompt_name,
        pr.description as prompt_description,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid
    UNION
    -- Also get all prompts from agent_department_prompts (department-specific prompts)
    SELECT DISTINCT
        adp.agent_id::text as agent_id,
        adp.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.name as prompt_name,
        pr.description as prompt_description,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM agent_department_prompts adp
    JOIN prompts pr ON pr.id = adp.prompt_id
    WHERE adp.agent_id = $1::uuid AND adp.active = true
),
prompt_departments_data AS (
    SELECT 
        adp.prompt_id::text as prompt_id,
        ARRAY_AGG(adp.department_id::text ORDER BY adp.created_at) as department_ids
    FROM agent_department_prompts adp
    WHERE adp.agent_id = $1::uuid AND adp.active = true
    GROUP BY adp.prompt_id
),
default_prompt_count AS (
    -- Count default prompts (from agent_prompts, not department-specific)
    -- Always return at least one row with count (0 if no prompts)
    SELECT COALESCE(COUNT(DISTINCT ap.prompt_id), 0)::integer as count
    FROM agent_prompts ap
    WHERE ap.agent_id = $1::uuid
),
prompt_mapping_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ap.prompt_id,
                jsonb_build_object(
                    'system_prompt', ap.system_prompt,
                    'name', COALESCE(ap.prompt_name, ''),
                    'description', COALESCE(ap.prompt_description, ''),
                    'created_at', ap.prompt_created_at::text,
                    'updated_at', ap.prompt_updated_at::text,
                    'department_ids', COALESCE(pdd.department_ids, NULL),
                    'can_delete', CASE
                        -- Department-specific prompts can always be deleted (fall back to default)
                        WHEN pdd.department_ids IS NOT NULL THEN true::boolean
                        -- Default prompts can be deleted if there's more than one
                        WHEN pdd.department_ids IS NULL AND COALESCE(dpc.count, 0) > 1 THEN true::boolean
                        -- Otherwise cannot delete (only one default prompt)
                        ELSE false::boolean
                    END
                )
            ),
            '{}'::jsonb
        ) as prompt_mapping
    FROM agent_all_prompts ap
    LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = ap.prompt_id
    CROSS JOIN default_prompt_count dpc
),
agent_departments_data AS (
    SELECT 
        ad.agent_id::text as agent_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM agent_departments ad
    WHERE ad.agent_id = $1::uuid AND ad.active = true
    GROUP BY ad.agent_id
),
agent_department_prompt_links AS (
    SELECT 
        COALESCE(
            (SELECT jsonb_object_agg(
                adp.department_id::text,
                adp.prompt_id::text
            )
            FROM agent_department_prompts adp
            WHERE adp.agent_id = $1::uuid AND adp.active = true),
            '{}'::jsonb
        ) as department_prompt_links
),
debug_data AS (
    SELECT 
        di.created_at,
        mrm.model_id::text,
        di.content
    FROM runs mr
    JOIN debug_info di ON di.run_id = mr.id
    JOIN run_models mrm ON mrm.run_id = mr.id
    WHERE mr.agent_id = $1::uuid
    AND mrm.active = true
    ORDER BY di.created_at DESC
    LIMIT 100
),
all_models AS (
    SELECT 
        id::text as model_id,
        name,
        COALESCE(description, '') as description,
        active
    FROM models
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE d.active = true
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
user_has_agent_access AS (
    -- Check if user has access to agent via department links
    SELECT EXISTS(
        SELECT 1 FROM agent_departments ad
        JOIN user_departments ud ON ud.id = ad.department_id::uuid
        WHERE ad.agent_id = $1::uuid AND ad.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default agents (no department links) are accessible to all
        SELECT COUNT(*) FROM agent_departments ad
        WHERE ad.agent_id = $1::uuid AND ad.active = true
    ) = 0 as has_access
),
valid_departments_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ud.id::text,
                jsonb_build_object(
                    'name', ud.name,
                    'description', COALESCE(ud.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(ud.id::text ORDER BY ud.name) as dept_ids
    FROM user_departments ud
)
SELECT 
    ai.agent_id,
    ai.name,
    ai.description,
    COALESCE(aap.system_prompt, '') as system_prompt,
    COALESCE(aap.prompt_id, NULL)::text as prompt_id,
    ai.temperature,
    ai.model_id,
    ai.reasoning,
    ai.active,
    ai.role,
    COALESCE(add.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(pmd.prompt_mapping, '{}'::jsonb) as prompt_mapping,
    COALESCE(adpl.department_prompt_links, '{}'::jsonb) as department_prompt_links,
    CASE 
        -- Default agents (no department_ids) are read-only for non-superadmin
        WHEN (COALESCE(add.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND up.role != 'superadmin') THEN false
        WHEN up.role = 'superadmin' THEN true
        WHEN up.role IN ('admin', 'instructional') AND uhaa.has_access THEN true
        ELSE false
    END as can_edit,
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'created_at', dd.created_at,
                'model_id', dd.model_id,
                'content', dd.content
            ) ORDER BY dd.created_at DESC
        )
        FROM debug_data dd),
        '[]'::jsonb
    ) as debug_info,
    COALESCE(
        (SELECT jsonb_object_agg(
            am.model_id,
            jsonb_build_object('name', am.name, 'description', am.description)
        )
        FROM all_models am),
        '{}'::jsonb
    ) as model_mapping,
    COALESCE(
        (SELECT jsonb_agg(am.model_id ORDER BY am.name)
        FROM all_models am
        WHERE am.active = true),
        '[]'::jsonb
    ) as valid_model_ids
FROM agent_info ai
LEFT JOIN agent_active_prompt aap ON aap.agent_id = ai.agent_id
LEFT JOIN agent_departments_data add ON add.agent_id = ai.agent_id
CROSS JOIN valid_departments_data vdd
CROSS JOIN prompt_mapping_data pmd
CROSS JOIN agent_department_prompt_links adpl
CROSS JOIN user_profile up
CROSS JOIN user_has_agent_access uhaa
WHERE uhaa.has_access = true

