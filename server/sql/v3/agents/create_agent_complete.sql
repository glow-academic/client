-- Create agent with prompt and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=temperature, $4=model_id, $5=reasoning, $6=active, $7=role, $8=prompt_id (nullable), $9=system_prompt (nullable), $10=department_ids (nullable text array)
WITH new_agent AS (
    INSERT INTO agents (name, description, temperature, model_id, reasoning, active, role, created_at, updated_at)
    VALUES ($1, $2, $3, $4, COALESCE($5::reasoning_effort, 'none'::reasoning_effort), $6, $7, NOW(), NOW())
    RETURNING id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $9, NOW(), NOW()
    WHERE $8 IS NULL AND $9 IS NOT NULL AND $9 != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $8,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $8 IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
link_prompt AS (
    -- Link agent to prompt if prompt_id exists
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        sp.prompt_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN selected_prompt_id sp
    ON CONFLICT (agent_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN UNNEST($10::text[]) as dept_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT agent_id FROM new_agent

