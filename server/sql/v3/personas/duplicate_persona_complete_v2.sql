-- Duplicate persona - fetches original and creates copy with prompt and department links in single query
-- Parameters: $1 = original_persona_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: new_persona_id (text), original_name (text)

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
original_persona AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        COALESCE(pr.system_prompt, '') as system_prompt,
        p.temperature,
        p.reasoning,
        ptm.model_id,
        p.color,
        p.icon
    FROM personas p
    LEFT JOIN persona_prompts pp ON pp.persona_id = p.id AND pp.active = true
    LEFT JOIN prompts pr ON pr.id = pp.prompt_id
    LEFT JOIN persona_text_model ptm ON ptm.persona_id = p.id AND ptm.active = true
    WHERE p.id = $1
),
original_departments AS (
    -- Get department IDs from original persona
    SELECT department_id
    FROM persona_departments
    WHERE persona_id = $1 AND active = true
),
new_persona AS (
    INSERT INTO personas (
        name,
        description,
        temperature,
        reasoning,
        color,
        icon,
        active,
        created_at,
        updated_at
    )
    SELECT 
        op.name || ' Copy',
        COALESCE(op.description, ''),
        op.temperature,
        COALESCE(op.reasoning::reasoning_effort, 'none'::reasoning_effort),
        op.color,
        op.icon,
        false,
        NOW(),
        NOW()
    FROM original_persona op
    RETURNING id::text as persona_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT op.system_prompt::text, NOW(), NOW()
    FROM original_persona op
    WHERE op.system_prompt IS NOT NULL AND op.system_prompt != ''
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
    RETURNING persona_id::text
),
link_text_model AS (
    -- Link text model if original persona had one
    INSERT INTO persona_text_model (persona_id, model_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        op.model_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN original_persona op
    WHERE op.model_id IS NOT NULL
    ON CONFLICT (persona_id, model_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING persona_id::text
),
copy_departments AS (
    -- Copy department links from original persona
    INSERT INTO persona_departments (persona_id, department_id, active, created_at, updated_at)
    SELECT 
        np.persona_id::uuid,
        od.department_id,
        true,
        NOW(),
        NOW()
    FROM new_persona np
    CROSS JOIN original_departments od
    RETURNING persona_id::text
)
SELECT 
    (SELECT persona_id FROM new_persona LIMIT 1) as new_persona_id,
    (SELECT name FROM original_persona LIMIT 1) as original_name

