-- Update persona with prompt and department links in a single transaction
-- Parameters: $1=personaId, $2=name, $3=description, $4=active, $5=color, $6=icon, $7=text_model_id (nullable), $8=audio_model_id (nullable), $9=voice (nullable), $10=reasoning, $11=temperature, $12=prompt_id (nullable), $13=system_prompt (nullable), $14=department_ids (nullable text array), $15=department_ids_for_prompt (nullable text array - never create default prompts, always department-specific overrides), $16=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $16::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $16::text IS NULL OR $16::text = '' THEN NULL::uuid
            ELSE $16::uuid
        END as resolved_profile_id
),
update_persona AS (
    UPDATE personas
    SET 
        name = $2,
        description = COALESCE($3, ''),
        active = $4,
        color = $5,
        icon = $6,
        reasoning = COALESCE($10::reasoning_effort, 'none'::reasoning_effort),
        temperature = $11,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as persona_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $13::text, NOW(), NOW()
    WHERE $12::text IS NULL AND $13::text IS NOT NULL AND $13::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $12::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $12::text IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
deactivate_department_prompts AS (
    -- Deactivate existing department-specific prompts for departments in the array
    UPDATE persona_department_prompts
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid 
    AND department_id = ANY(SELECT dept_id::uuid FROM UNNEST($15::text[]) as dept_id)
    AND active = true
),
handle_department_prompts AS (
    -- Handle department-specific prompts for all departments in array (never create default prompts)
    INSERT INTO persona_department_prompts (persona_id, department_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, dept_id::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    CROSS JOIN UNNEST($15::text[]) as dept_id
    WHERE COALESCE(array_length($15::text[], 1), 0) > 0 AND sp.prompt_id IS NOT NULL
    ON CONFLICT (persona_id, department_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_default_prompt_content AS (
    -- Get the default prompt content for comparison (for pruning)
    SELECT pr.system_prompt
    FROM persona_prompts pp
    JOIN prompts pr ON pr.id = pp.prompt_id
    WHERE pp.persona_id = $1::uuid AND pp.active = true
    LIMIT 1
),
prune_duplicate_prompts AS (
    -- Prune department-specific prompts that match the default prompt content
    -- Compare the newly created/updated prompt content to the default prompt content
    -- If they match, delete the department-specific override (will fall back to default)
    DELETE FROM persona_department_prompts pdp
    WHERE pdp.persona_id = $1::uuid
    AND pdp.department_id = ANY(SELECT dept_id::uuid FROM UNNEST($15::text[]) as dept_id)
    AND EXISTS (
        SELECT 1 
        FROM get_default_prompt_content gdc
        JOIN selected_prompt_id sp ON sp.prompt_id IS NOT NULL
        JOIN prompts pr ON pr.id = sp.prompt_id::uuid
        WHERE pr.system_prompt = gdc.system_prompt
    )
),
deactivate_text_models AS (
    -- Deactivate all existing text models for this persona
    UPDATE persona_text_model
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid AND active = true
),
link_text_model AS (
    -- Link text model if provided
    INSERT INTO persona_text_model (persona_id, model_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $7::uuid,
        true,
        NOW(),
        NOW()
    WHERE $7::text IS NOT NULL AND $7::text != ''
    ON CONFLICT (persona_id, model_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_audio_models AS (
    -- Deactivate all existing audio models for this persona
    UPDATE persona_audio_model
    SET active = false, updated_at = NOW()
    WHERE persona_id = $1::uuid AND active = true
),
link_audio_model AS (
    -- Link audio model if provided (requires voice)
    INSERT INTO persona_audio_model (persona_id, model_id, voice, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $8::uuid,
        $9::voice,
        true,
        NOW(),
        NOW()
    WHERE $8::text IS NOT NULL AND $8::text != '' AND $9::text IS NOT NULL AND $9::text != ''
    ON CONFLICT (persona_id, model_id, voice) DO UPDATE SET
        active = true,
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
    FROM UNNEST($14::text[]) as dept_id
    WHERE COALESCE(array_length($14::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM update_persona

