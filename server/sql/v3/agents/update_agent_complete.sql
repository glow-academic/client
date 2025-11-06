-- Update agent with prompt and department links in a single transaction
-- Parameters: $1=agentId, $2=name, $3=description, $4=temperature, $5=model_id, $6=reasoning, $7=active, $8=role, $9=prompt_id (nullable), $10=system_prompt (nullable), $11=department_ids (nullable text array), $12=department_id (nullable)
WITH update_agent AS (
    UPDATE agents
    SET 
        name = $2,
        description = $3,
        temperature = $4,
        model_id = $5,
        reasoning = COALESCE($6::reasoning_effort, 'none'::reasoning_effort),
        active = $7,
        role = $8,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $10::text, NOW(), NOW()
    WHERE $9::text IS NULL AND $10::text IS NOT NULL AND $10::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $9::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $9::text IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
deactivate_department_prompt AS (
    -- Deactivate existing department-specific prompt if department_id provided
    UPDATE agent_department_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = $1::uuid 
    AND department_id = $12::uuid 
    AND active = true
),
handle_department_prompt AS (
    -- Handle department-specific prompt if department_id and prompt provided
    INSERT INTO agent_department_prompts (agent_id, department_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, $12::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    WHERE $12::uuid IS NOT NULL AND sp.prompt_id IS NOT NULL
    ON CONFLICT (agent_id, department_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_default_prompts AS (
    -- Deactivate all existing default prompts
    UPDATE agent_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = $1::uuid AND active = true
),
handle_default_prompt AS (
    -- Handle default prompt if no department_id but prompt provided
    INSERT INTO agent_prompts (agent_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    WHERE $12::uuid IS NULL AND sp.prompt_id IS NOT NULL
    ON CONFLICT (agent_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM agent_departments WHERE agent_id = $1::uuid
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($11::text[]) as dept_id
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT agent_id FROM update_agent

