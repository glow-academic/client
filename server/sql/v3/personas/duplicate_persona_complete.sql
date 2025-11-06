-- Duplicate persona with prompt and department links in a single transaction
-- Parameters: $1=personaId (original), $2=name, $3=description, $4=temperature, $5=reasoning, $6=model_id, $7=color, $8=icon, $9=system_prompt (nullable)
WITH original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM persona_departments
    WHERE persona_id = $1::uuid AND active = true
),
new_persona AS (
    INSERT INTO personas (
        name,
        description,
        temperature,
        reasoning,
        model_id,
        color,
        icon,
        active,
        created_at,
        updated_at
    )
    VALUES (
        $2 || ' Copy',
        COALESCE($3, ''),
        $4,
        COALESCE($5::reasoning_effort, 'none'::reasoning_effort),
        $6::uuid,
        $7,
        $8,
        false,
        NOW(),
        NOW()
    )
    RETURNING id::text as persona_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $9::text, NOW(), NOW()
    WHERE $9::text IS NOT NULL AND $9::text != ''
    RETURNING id::text as prompt_id
),
link_prompt AS (
    -- Link persona to prompt if prompt was created
    INSERT INTO persona_prompts (persona_id, prompt_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        newp.prompt_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN new_prompt newp
    ON CONFLICT (persona_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
copy_departments AS (
    -- Copy department links if they existed on the original persona
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM new_persona

