-- Duplicate persona - fetches original and creates copy with prompt and department links in single query
-- Parameters: $1 = original_persona_id (uuid), $2 = profile_id (uuid)
-- Returns: new_persona_id (text), original_name (text)

WITH user_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
original_persona AS (
    SELECT 
        p.id,
        p.name,
        p.description,
        COALESCE(pr.system_prompt, '') as system_prompt,
        p.color,
        p.icon
    FROM personas p
    LEFT JOIN prompts pr ON pr.id IS NULL
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
        color,
        icon,
        active,
        created_at,
        updated_at
    )
    SELECT 
        op.name || ' Copy',
        COALESCE(op.description, ''),
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
    -- NOTE: persona_prompts table was dropped in migration 44
    -- Personas are now linked to prompts via agents, not directly
    -- This CTE is kept for compatibility but does nothing
    SELECT 1 WHERE false
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
    (SELECT name FROM original_persona LIMIT 1) as original_name,
    (SELECT actor_name FROM user_profile LIMIT 1) as actor_name

