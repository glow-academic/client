-- Update agent with prompt and department links in a single transaction
-- Parameters: $1=agentId, $2=name, $3=description, $4=model_id, $5=active, $6=role, $7=prompt_id (nullable), $8=system_prompt (nullable), $9=department_ids (nullable text array), $10=department_ids_for_prompt (nullable text array - never create default prompts, always department-specific overrides), $11=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $11::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND first_name = 'Default' ORDER BY created_at DESC LIMIT 1)
            WHEN $11::text IS NULL OR $11::text = '' THEN NULL::uuid
            ELSE $11::uuid
        END as resolved_profile_id
),
update_agent AS (
    UPDATE agents
    SET 
        name = $2,
        description = $3,
        model_id = $4,
        active = $5,
        role = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as agent_id
),
new_prompt AS (
    -- Create prompt only if system_prompt provided and prompt_id not provided
    INSERT INTO prompts (system_prompt, created_at, updated_at)
    SELECT $8::text, NOW(), NOW()
    WHERE $7::text IS NULL AND $8::text IS NOT NULL AND $8::text != ''
    RETURNING id::text as prompt_id
),
selected_prompt_id AS (
    -- Use provided prompt_id or newly created prompt_id (only return row if prompt exists)
    SELECT COALESCE(
        $7::text,
        (SELECT prompt_id FROM new_prompt LIMIT 1)
    ) as prompt_id
    WHERE $7::text IS NOT NULL OR EXISTS (SELECT 1 FROM new_prompt)
),
deactivate_department_prompts AS (
    -- Deactivate existing department-specific prompts for departments in the array
    UPDATE agent_department_prompts
    SET active = false, updated_at = NOW()
    WHERE agent_id = $1::uuid 
    AND department_id = ANY(SELECT dept_id::uuid FROM UNNEST($10::text[]) as dept_id)
    AND active = true
),
handle_department_prompts AS (
    -- Handle department-specific prompts for all departments in array (never create default prompts)
    INSERT INTO agent_department_prompts (agent_id, department_id, prompt_id, active, created_at, updated_at)
    SELECT $1::uuid, dept_id::uuid, sp.prompt_id::uuid, true, NOW(), NOW()
    FROM selected_prompt_id sp
    CROSS JOIN UNNEST($10::text[]) as dept_id
    WHERE COALESCE(array_length($10::text[], 1), 0) > 0 AND sp.prompt_id IS NOT NULL
    ON CONFLICT (agent_id, department_id, prompt_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
get_default_prompt_content AS (
    -- Get the default prompt content for comparison (for pruning)
    SELECT pr.system_prompt
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid AND ap.active = true
    LIMIT 1
),
prune_duplicate_prompts AS (
    -- Prune department-specific prompts that match the default prompt content
    DELETE FROM agent_department_prompts adp
    WHERE adp.agent_id = $1::uuid
    AND adp.department_id = ANY(SELECT dept_id::uuid FROM UNNEST($10::text[]) as dept_id)
    AND EXISTS (
        SELECT 1 FROM get_default_prompt_content gdc
        JOIN selected_prompt_id sp ON sp.prompt_id IS NOT NULL
        JOIN prompts pr ON pr.id = sp.prompt_id::uuid
        WHERE pr.system_prompt = gdc.system_prompt
    )
),
replace_departments AS (
    -- Delete all existing department links
    DELETE FROM agent_departments WHERE agent_id = $1::uuid
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO agent_departments (agent_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($9::text[]) as dept_id
    WHERE COALESCE(array_length($9::text[], 1), 0) > 0
    ON CONFLICT (agent_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT agent_id FROM update_agent

