WITH source_agent AS (
    SELECT 
        a.id as source_id,
        a.name,
        a.description,
        a.temperature,
        a.model_id,
        a.reasoning,
        a.role,
        ap.prompt_id,
        COALESCE(pr.system_prompt, '') as system_prompt
    FROM agents a
    LEFT JOIN agent_prompts ap ON ap.agent_id = a.id AND ap.active = true
    LEFT JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE a.id = $1::uuid
),
new_prompt AS (
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT system_prompt, NOW(), NOW()
    FROM source_agent
    RETURNING id as prompt_id
),
new_agent AS (
    INSERT INTO agents (name, description, temperature, model_id, reasoning, active, role, created_at, updated_at)
    SELECT 
        sa.name || ' Copy',
        sa.description,
        sa.temperature,
        sa.model_id,
        COALESCE(sa.reasoning::reasoning_effort, 'none'::reasoning_effort),
        false,
        sa.role,
        NOW(),
        NOW()
    FROM source_agent sa
    RETURNING id::text as agent_id
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
SELECT agent_id FROM new_agent

