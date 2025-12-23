-- Create agent with prompt and department links in a single transaction
-- Parameters: $1=name (text), $2=description (text), $3=model_id (uuid), $4=active (boolean), $5=role (text), $6=prompt_id (uuid, nullable), $7=system_prompt (text, nullable), $8=department_ids (text[], nullable), $9=profile_id (uuid, required)
-- All parameters are explicitly cast for type introspection
WITH user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $9::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role,
        $8::text[]
    ) as validation_passed
    FROM user_profile up
),
actor_profile AS (
    SELECT 
        $9::uuid as resolved_profile_id,
        up.actor_name
    FROM user_profile up
),
new_agent AS (
    INSERT INTO agents (name, description, model_id, active, role, created_at, updated_at)
    SELECT 
        $1::text, 
        $2::text, 
        $3::uuid, 
        $4::boolean, 
        $5::text, 
        NOW(), 
        NOW()
    RETURNING id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $7::text, NOW(), NOW()
    WHERE $6::uuid IS NULL AND $7::text IS NOT NULL AND $7::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $6::uuid::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $6::uuid IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
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
    CROSS JOIN UNNEST($8::text[]) as dept_id
    WHERE COALESCE(array_length($8::text[], 1), 0) > 0
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    na.agent_id,
    ap.actor_name
FROM new_agent na
CROSS JOIN actor_profile ap

