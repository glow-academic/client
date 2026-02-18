-- Update persona with prompt and department links in a single transaction
-- Parameters: $1=personaId, $2=name, $3=description, $4=active, $5=color, $6=icon, $7=model_id, $8=reasoning, $9=temperature, $10=prompt_id (nullable), $11=system_prompt (nullable), $12=department_ids (nullable text array), $13=department_id (nullable)
WITH update_persona AS (
    UPDATE personas
    SET 
        name = $2,
        description = COALESCE($3, ''),
        active = $4,
        color = $5,
        icon = $6,
        model_id = $7::uuid,
        reasoning = COALESCE($8::reasoning_effort, 'none'::reasoning_effort),
        temperature = $9,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as persona_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $11::text, NOW(), NOW()
    WHERE $10::text IS NULL AND $11::text IS NOT NULL AND $11::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $10::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $10::text IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
deactivate_department_prompt AS (
    -- Deactivate existing department-specific prompt if department_id provided
    UPDATE persona_department_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid 
    AND department_id = $13::uuid 
    AND active = true
),
handle_department_prompt AS (
    -- Handle department-specific prompt if department_id and prompt provided
    INSERT INTO persona_department_prompts (persona_id, department_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, $13::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    WHERE $13::uuid IS NOT NULL AND sp.prompt_id IS NOT NULL
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_default_prompts AS (
    -- Deactivate all existing default prompts
    UPDATE persona_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid AND active = true
),
handle_default_prompt AS (
    -- Handle default prompt if no department_id but prompt provided
    -- Uses the partial unique index (one active per persona) to upsert
    INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    WHERE $13::uuid IS NULL AND sp.prompt_id IS NOT NULL
    ON CONFLICT (persona_id) WHERE (active = true) DO UPDATE SET
        prompt_id = EXCLUDED.prompt_id,
        updated_at = NOW()
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM persona_departments WHERE persona_id = $1::uuid
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($12::text[]) as dept_id
    WHERE COALESCE(array_length($12::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM update_persona

