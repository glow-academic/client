-- Duplicate agent with profile_id for auditing
-- Converted to function

-- Create function
CREATE OR REPLACE FUNCTION api_duplicate_agent_v4(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT agent_id AS agent_id,
           profile_id AS profile_id
),
actor_profile AS (
    SELECT 
        x.profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM params x
    JOIN profile p ON p.id = x.profile_id
),
source_agent AS (
    SELECT 
        a.id as source_id,
        (SELECT n.name FROM agent_names an JOIN names n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        (SELECT (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1) FROM agent_descriptions ad JOIN descriptions d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1),
        (SELECT m.id FROM agent_models am JOIN models m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) as model_id,
        COALESCE(da.artifact::text, '') as role,  -- Derive from domain_artifacts via agent_domains
        ap.prompt_id,
        COALESCE(pr.system_prompt, '') as system_prompt,
        -- Get temperature and reasoning from junction tables
        atl.model_temperature_level_id,
        arl.model_reasoning_level_id,
        da.artifact  -- Need artifact for linking
    FROM params x
    JOIN agents a ON a.id = x.agent_id
    LEFT JOIN agent_domains adom ON adom.agent_id = a.id
    LEFT JOIN domain_artifacts da ON da.domain_id = adom.domain_id
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr ON pr.id = ap.prompt_id
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
),
new_prompt AS (
    INSERT INTO prompts (name, description, system_prompt, created_at, updated_at)
    SELECT 
        COALESCE(pr.name, 'Agent Prompt') || ' Copy',
        COALESCE(pr.description, ''),
        sa.system_prompt, 
        NOW(), 
        NOW()
    FROM source_agent sa
    LEFT JOIN prompts pr ON pr.id = sa.prompt_id
    RETURNING id as prompt_id
),
-- Insert name into names table and get ID
name_resource AS (
    INSERT INTO names (name, created_at, updated_at)
    SELECT sa.name || ' Copy', NOW(), NOW()
    FROM source_agent sa
    WHERE sa.name IS NOT NULL AND sa.name != ''
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id as name_id
),
-- Insert description into descriptions table and get ID
description_resource AS (
    INSERT INTO descriptions (description, created_at, updated_at)
    SELECT sa.description, NOW(), NOW()
    FROM source_agent sa
    WHERE sa.description IS NOT NULL AND sa.description != ''
    ON CONFLICT (description) DO UPDATE SET updated_at = NOW()
    RETURNING id as description_id
),
new_agent AS (
    -- Create agent (without name/description/model_id/active columns)
    INSERT INTO agent (created_at, updated_at)
    SELECT 
        NOW(),
        NOW()
    FROM source_agent sa
    RETURNING id::text as agent_id
),
-- Link agent to name
link_agent_name AS (
    INSERT INTO agent_names (agent_id, name_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        nr.name_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN name_resource nr
    ON CONFLICT (agent_id, name_id) DO UPDATE SET updated_at = NOW()
),
-- Link agent to description
link_agent_description AS (
    INSERT INTO agent_descriptions (agent_id, description_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        dr.description_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN description_resource dr
    ON CONFLICT (agent_id, description_id) DO UPDATE SET updated_at = NOW()
),
-- Link agent to model
link_agent_model AS (
    INSERT INTO agent_models (agent_id, model_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_id,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN source_agent sa
    WHERE sa.model_id IS NOT NULL
    ON CONFLICT (agent_id, model_id) DO UPDATE SET updated_at = NOW()
),
-- Link agent active flag (defaults to false)
link_agent_active_flag AS (
    INSERT INTO agent_flags (agent_id, flag_id, type, value, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        f.id,
        'active'::type_agent_flags,
        false,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN flags f
    WHERE f.name = 'active'
    ON CONFLICT (agent_id, flag_id, type) DO UPDATE SET 
        value = false,
        updated_at = NOW()
),
-- Create domain for duplicated agent
create_domain_for_duplicate AS (
    INSERT INTO domains (created_at, updated_at)
    SELECT NOW(), NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.role IS NOT NULL AND sa.role != ''
    RETURNING id as domain_id
),
copy_domain_artifact AS (
    -- Link domain to artifact via domain_artifacts
    INSERT INTO domain_artifacts (domain_id, artifact, created_at, updated_at)
    SELECT 
        cdfd.domain_id,
        CAST(sa.role AS artifacts),
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    CROSS JOIN create_domain_for_duplicate cdfd
    WHERE sa.role IS NOT NULL AND sa.role != ''
    ON CONFLICT (domain_id, artifact) DO UPDATE SET
        updated_at = NOW()
),
copy_domain_link AS (
    -- Link agent to domain via agent_domains
    INSERT INTO agent_domains (agent_id, domain_id, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        cdfd.domain_id,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    CROSS JOIN create_domain_for_duplicate cdfd
    WHERE sa.role IS NOT NULL AND sa.role != ''
    ON CONFLICT (agent_id, domain_id) DO UPDATE SET
        updated_at = NOW()
),
copy_temperature AS (
    INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_temperature_level_id,
        true,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.model_temperature_level_id IS NOT NULL
),
copy_reasoning AS (
    INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sa.model_reasoning_level_id,
        true,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.model_reasoning_level_id IS NOT NULL
),
link_prompt AS (
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT na.agent_id::uuid, np.prompt_id, true, NOW(), NOW()
    FROM new_agent na
    CROSS JOIN new_prompt np
),
copy_departments AS (
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        ad.department_id,
        ad.active,
        NOW(),
        NOW()
    FROM source_agent sa
    JOIN agent_departments ad ON ad.agent_id = sa.source_id AND ad.active = true
    CROSS JOIN new_agent na
)
SELECT 
    na.agent_id,
    sa.name as agent_name,
    ap.actor_name
FROM new_agent na
CROSS JOIN source_agent sa
CROSS JOIN actor_profile ap
$$;
