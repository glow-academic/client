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
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
source_agent AS (
    SELECT 
        a.id as source_id,
        a.name,
        a.description,
        a.model_id,
        COALESCE(aa.role, '') as role,  -- Derive from artifact_agents
        ap.prompt_id,
        COALESCE(pr.system_prompt, '') as system_prompt,
        -- Get temperature and reasoning from junction tables
        atl.model_temperature_level_id,
        arl.model_reasoning_level_id,
        aa.artifact_id  -- Need artifact_id for linking
    FROM params x
    JOIN agents a ON a.id = x.agent_id
    LEFT JOIN artifact_agents aa ON aa.agent_id = a.id AND aa.artifact_instance_id IS NULL
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
new_agent AS (
    INSERT INTO agents (name, description, model_id, active, created_at, updated_at)
    SELECT 
        sa.name || ' Copy',
        sa.description,
        sa.model_id,
        false,
        NOW(),
        NOW()
    FROM source_agent sa
    RETURNING id::text as agent_id
),
copy_artifact_link AS (
    -- Copy artifact_agents link
    INSERT INTO artifact_agents (artifact_id, artifact_instance_id, agent_id, role, created_at, updated_at)
    SELECT 
        sa.artifact_id,
        NULL,  -- Agent-level assignment
        na.agent_id::uuid,
        sa.role,
        NOW(),
        NOW()
    FROM source_agent sa
    CROSS JOIN new_agent na
    WHERE sa.artifact_id IS NOT NULL
    ON CONFLICT (artifact_id, artifact_instance_id, agent_id, role) DO NOTHING
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
