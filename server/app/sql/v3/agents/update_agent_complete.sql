-- Update agent with prompt and department links in a single transaction
-- @params
--   agent_id: uuid
--   name: text
--   description: text
--   model_id: uuid
--   active: boolean
--   role: agent_role
--   prompt_id?: uuid
--   system_prompt?: text
--   department_ids: text[] = {}
--   department_ids_for_prompt: text[] = {}
--   profile_id: uuid
-- All parameters are cast exactly once in params CTE for reliable type introspection
WITH params AS (
    SELECT $1::uuid AS agent_id,
           $2::text AS name,
           $3::text AS description,
           $4::uuid AS model_id,
           $5::boolean AS active,
           $6::agent_role AS role,
           $7::uuid AS prompt_id,
           NULLIF($8::text, '') AS system_prompt,
           COALESCE($9::text[], ARRAY[]::text[]) AS department_ids,
           COALESCE($10::text[], ARRAY[]::text[]) AS department_ids_for_prompt,
           $11::uuid AS profile_id
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
)
SELECT 
    ua.agent_id,
    ap.actor_name
FROM update_agent ua
CROSS JOIN actor_profile ap

