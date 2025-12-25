-- Create agent with prompt and department links in a single transaction
-- Converted to function

-- Create function
CREATE OR REPLACE FUNCTION api_create_agent_v3(
    name text,
    description text,
    model_id uuid,
    active boolean,
    role agent_role,
    profile_id uuid,
    prompt_id uuid DEFAULT NULL,
    system_prompt text DEFAULT NULL,
    department_ids uuid[] DEFAULT ARRAY[]::uuid[],
    model_temperature_level_id uuid DEFAULT NULL,
    model_reasoning_level_id uuid DEFAULT NULL,
    model_voice_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS TABLE (
    agent_id text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT
        name AS name,
        description AS description,
        model_id AS model_id,
        active AS active,
        role AS role,
        prompt_id AS prompt_id,
        NULLIF(system_prompt, '') AS system_prompt,
        COALESCE(department_ids, ARRAY[]::uuid[]) AS department_ids,
        model_temperature_level_id AS model_temperature_level_id,
        model_reasoning_level_id AS model_reasoning_level_id,
        COALESCE(model_voice_ids, ARRAY[]::uuid[]) AS model_voice_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    JOIN params x ON p.id = x.profile_id
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role::text,
        (SELECT department_ids::text[] FROM params)
    ) AS ok
    FROM user_profile up
),
assert_permissions AS (
    -- Ensure permissions are valid before proceeding
    SELECT 1
    FROM validate_create_permissions
    WHERE ok = true
),
actor_profile AS (
    SELECT 
        x.profile_id AS resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
new_agent AS (
    INSERT INTO agents (name, description, model_id, active, role, created_at, updated_at)
    SELECT 
        x.name,
        x.description,
        x.model_id,
        x.active,
        x.role,
        NOW(), 
        NOW()
    FROM params x
    JOIN assert_permissions ap ON TRUE
    RETURNING id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT x.system_prompt, NOW(), NOW()
    FROM params x
    WHERE x.prompt_id IS NULL AND x.system_prompt IS NOT NULL
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        (SELECT prompt_id::text FROM params),
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE (SELECT prompt_id FROM params) IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
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
        dept_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.department_ids) AS dept_id
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_temperature_level AS (
    -- Link temperature level if provided
    INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        x.model_temperature_level_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    WHERE x.model_temperature_level_id IS NOT NULL
    ON CONFLICT (agent_id, model_temperature_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_reasoning_level AS (
    -- Link reasoning level if provided
    INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        x.model_reasoning_level_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    WHERE x.model_reasoning_level_id IS NOT NULL
    ON CONFLICT (agent_id, model_reasoning_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_voices AS (
    -- Link voices if provided (array is never NULL, but may be empty)
    INSERT INTO agent_voices (agent_id, model_voice_id, active, created_at, updated_at)
    SELECT 
        na.agent_id::uuid,
        voice_id,
        true,
        NOW(),
        NOW()
    FROM new_agent na
    CROSS JOIN params x
    CROSS JOIN UNNEST(x.model_voice_ids) AS voice_id
    ON CONFLICT (agent_id, model_voice_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    na.agent_id,
    ap.actor_name
FROM new_agent na
CROSS JOIN actor_profile ap
$$;
