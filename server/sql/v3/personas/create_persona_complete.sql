-- Create persona with prompt and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=color, $5=icon, $6=model_id, $7=reasoning, $8=temperature, $9=prompt_id (nullable), $10=system_prompt (nullable), $11=department_ids (nullable text array)
WITH new_persona AS (
    INSERT INTO personas (name, description, active, color, icon, model_id, reasoning, temperature, created_at, updated_at)
    VALUES ($1, COALESCE($2, ''), $3, $4, $5, $6::uuid, COALESCE($7::reasoning_effort, 'none'::reasoning_effort), $8, NOW(), NOW())
    RETURNING id::text as persona_id
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
deactivate_all_prompts AS (
    -- Deactivate all existing default prompts
    UPDATE persona_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = (SELECT persona_id::uuid FROM new_persona) AND active = true
),
link_prompt AS (
    -- Link persona to prompt if prompt_id exists
    INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        sp.prompt_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN selected_prompt_id sp
    ON CONFLICT (persona_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN UNNEST($11::text[]) as dept_id
    WHERE COALESCE(array_length($11::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM new_persona

