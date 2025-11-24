-- Create persona with prompt and department links in a single transaction
-- Parameters: $1=name, $2=description, $3=active, $4=color, $5=icon, $6=text_model_id (nullable), $7=audio_model_id (nullable), $8=voice (nullable), $9=reasoning, $10=temperature, $11=prompt_id (nullable), $12=system_prompt (nullable), $13=department_ids (nullable text array), $14=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $14::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $14::text IS NULL OR $14::text = '' THEN NULL::uuid
            ELSE $14::uuid
        END as resolved_profile_id
),
new_persona AS (
    INSERT INTO personas (name, description, active, color, icon, reasoning, temperature, created_at, updated_at)
    VALUES ($1, COALESCE($2, ''), $3, $4, $5, COALESCE($9::reasoning_effort, 'none'::reasoning_effort), $10, NOW(), NOW())
    RETURNING id::text as persona_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $12::text, NOW(), NOW()
    WHERE $11::text IS NULL AND $12::text IS NOT NULL AND $12::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $11::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $11::text IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
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
link_text_model AS (
    -- Link text model if provided
    INSERT INTO persona_text_model (persona_id, model_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        $6::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    WHERE $6::text IS NOT NULL AND $6::text != ''
    ON CONFLICT (persona_id, model_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_audio_model AS (
    -- Link audio model if provided (requires voice)
    INSERT INTO persona_audio_model (persona_id, model_id, voice, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        $7::uuid,
        $8::voice,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    WHERE $7::text IS NOT NULL AND $7::text != '' AND $8::text IS NOT NULL AND $8::text != ''
    ON CONFLICT (persona_id, model_id, voice) DO UPDATE SET
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
    CROSS JOIN UNNEST($13::text[]) as dept_id
    WHERE COALESCE(array_length($13::text[], 1), 0) > 0
    ON CONFLICT (persona_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT persona_id FROM new_persona

