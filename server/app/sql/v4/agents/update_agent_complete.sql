-- Update agent with prompt and department links in a single transaction
-- Converted to function

-- Create function
CREATE OR REPLACE FUNCTION api_update_agent_v4(
    agent_id uuid,
    name text,
    description text,
    model_id uuid,
    active boolean,
    role agent_role,
    profile_id uuid,
    prompt_id uuid DEFAULT NULL,
    system_prompt text DEFAULT NULL,
    department_ids text[] DEFAULT ARRAY[]::text[],
    department_ids_for_prompt text[] DEFAULT ARRAY[]::text[],
    model_temperature_level_id uuid DEFAULT NULL,
    model_reasoning_level_id uuid DEFAULT NULL,
    model_voice_ids text[] DEFAULT ARRAY[]::text[]
)
RETURNS TABLE (
    agent_id text,
    actor_name text
)
LANGUAGE sql
AS $$
WITH params AS (
    SELECT
        agent_id AS agent_id,
        name AS name,
        description AS description,
        model_id AS model_id,
        active AS active,
        role AS role,
        prompt_id AS prompt_id,
        NULLIF(system_prompt, '') AS system_prompt,
        COALESCE(department_ids, ARRAY[]::text[]) AS department_ids,
        COALESCE(department_ids_for_prompt, ARRAY[]::text[]) AS department_ids_for_prompt,
        model_temperature_level_id AS model_temperature_level_id,
        model_reasoning_level_id AS model_reasoning_level_id,
        COALESCE(model_voice_ids, ARRAY[]::text[]) AS model_voice_ids,
        profile_id AS profile_id
),
user_profile AS (
    SELECT 
        p.role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
object_current_departments AS (
    -- Get agent's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN agent_departments ON agent_departments.agent_id = x.agent_id AND agent_departments.active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM params x
    JOIN profile_departments ON profile_departments.profile_id = x.profile_id AND profile_departments.active = true
),
validate_update_permissions AS (
    -- Validate department permissions for update operation
    SELECT validate_department_update_permissions(
        up.role::text,
        ocd.department_ids,
        ud.department_ids
    ) as validation_passed
    FROM user_profile up
    CROSS JOIN object_current_departments ocd
    CROSS JOIN user_departments ud
),
actor_profile AS (
    SELECT 
        x.profile_id as resolved_profile_id,
        up.actor_name
    FROM params x
    CROSS JOIN user_profile up
),
update_agent AS (
    UPDATE agents
    SET 
        name = x.name,
        description = x.description,
        model_id = x.model_id,
        active = x.active,
        role = x.role,
        updated_at = NOW()
    FROM params x
    WHERE agents.id = x.agent_id
    RETURNING agents.id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT x.system_prompt, NOW(), NOW()
    FROM params x
    WHERE x.prompt_id IS NULL AND x.system_prompt IS NOT NULL AND x.system_prompt != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        x.prompt_id::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    FROM params x
    WHERE x.prompt_id IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
deactivate_department_prompts AS (
    -- Deactivate existing department-specific prompts for departments in the array
    UPDATE agent_department_prompts
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE agent_department_prompts.agent_id = x.agent_id 
    AND agent_department_prompts.department_id = ANY(SELECT dept_id::uuid FROM UNNEST(x.department_ids_for_prompt) as dept_id)
    AND agent_department_prompts.active = true
    RETURNING agent_department_prompts.agent_id
),
handle_department_prompts AS (
    -- Handle department-specific prompts for all departments in array (never create default prompts)
    INSERT INTO agent_department_prompts (agent_id, department_id, prompt_id, active, created_at, updated_at)
    SELECT x.agent_id, dept_id::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM params x
    CROSS JOIN selected_prompt_id sp
    CROSS JOIN UNNEST(x.department_ids_for_prompt) as dept_id
    WHERE COALESCE(array_length(x.department_ids_for_prompt, 1), 0) > 0 AND sp.prompt_id IS NOT NULL
    ON CONFLICT (agent_id, department_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_default_prompt_content AS (
    -- Get the default prompt content for comparison (for pruning)
    SELECT pr.system_prompt
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id AND ap.active = true
    JOIN prompts pr ON pr.id = ap.prompt_id
    LIMIT 1
),
prune_duplicate_prompts AS (
    -- Prune department-specific prompts that match the default prompt content
    DELETE FROM agent_department_prompts adp
    USING params x
    WHERE adp.agent_id = x.agent_id
    AND adp.department_id = ANY(SELECT dept_id::uuid FROM UNNEST(x.department_ids_for_prompt) as dept_id)
    AND EXISTS (
        SELECT 1 FROM get_default_prompt_content gdc
        JOIN selected_prompt_id sp ON sp.prompt_id IS NOT NULL
        JOIN prompts pr ON pr.id = sp.prompt_id::uuid
        WHERE pr.system_prompt = gdc.system_prompt
    )
    RETURNING adp.agent_id
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM agent_departments
    USING params x
    WHERE agent_departments.agent_id = x.agent_id
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        x.agent_id,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM params x
    CROSS JOIN UNNEST(x.department_ids) as dept_id
    WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
deactivate_temperature_levels AS (
    -- Deactivate existing temperature levels if model_temperature_level_id is provided
    UPDATE agent_temperature_levels
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE agent_temperature_levels.agent_id = x.agent_id
    AND x.model_temperature_level_id IS NOT NULL
    RETURNING agent_temperature_levels.agent_id
),
update_temperature_level AS (
    -- Insert or update temperature level if model_temperature_level_id is provided
    INSERT INTO agent_temperature_levels (agent_id, model_temperature_level_id, active, created_at, updated_at)
    SELECT x.agent_id, x.model_temperature_level_id, true, NOW(), NOW()
    FROM params x
    WHERE x.model_temperature_level_id IS NOT NULL
    ON CONFLICT (agent_id, model_temperature_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING agent_temperature_levels.agent_id
),
deactivate_reasoning_levels AS (
    -- Deactivate existing reasoning levels if model_reasoning_level_id is provided
    UPDATE agent_reasoning_levels
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE agent_reasoning_levels.agent_id = x.agent_id
    AND x.model_reasoning_level_id IS NOT NULL
    RETURNING agent_reasoning_levels.agent_id
),
update_reasoning_level AS (
    -- Insert or update reasoning level if model_reasoning_level_id is provided
    INSERT INTO agent_reasoning_levels (agent_id, model_reasoning_level_id, active, created_at, updated_at)
    SELECT x.agent_id, x.model_reasoning_level_id, true, NOW(), NOW()
    FROM params x
    WHERE x.model_reasoning_level_id IS NOT NULL
    ON CONFLICT (agent_id, model_reasoning_level_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING agent_reasoning_levels.agent_id
),
deactivate_voices AS (
    -- Deactivate existing voices if model_voice_ids is provided
    UPDATE agent_voices
    SET active = false, updated_at = NOW()
    FROM params x
    WHERE agent_voices.agent_id = x.agent_id
    AND COALESCE(array_length(x.model_voice_ids, 1), 0) > 0
    RETURNING agent_voices.agent_id
),
update_voices AS (
    -- Insert or update voices if model_voice_ids is provided
    INSERT INTO agent_voices (agent_id, model_voice_id, active, created_at, updated_at)
    SELECT x.agent_id, voice_id::uuid, true, NOW(), NOW()
    FROM params x
    CROSS JOIN UNNEST(x.model_voice_ids) as voice_id
    WHERE COALESCE(array_length(x.model_voice_ids, 1), 0) > 0
    ON CONFLICT (agent_id, model_voice_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
    RETURNING agent_voices.agent_id
)
SELECT 
    ua.agent_id,
    ap.actor_name
FROM update_agent ua
CROSS JOIN actor_profile ap
CROSS JOIN validate_update_permissions vup
WHERE vup.validation_passed = true
$$;
