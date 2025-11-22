-- Update a prompt with department links
-- Parameters: $1=prompt_id, $2=system_prompt, $3=department_ids (text array, nullable)
WITH update_prompt AS (
    UPDATE prompts
    SET 
        system_prompt = $2,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as prompt_id, system_prompt, created_at, updated_at
),
replace_departments AS (
    -- Deactivate all existing department links
    UPDATE prompt_departments 
    SET active = false, updated_at = NOW()
    WHERE prompt_id = $1::uuid AND active = true
),
link_departments AS (
    -- Insert new department links if provided (array is never NULL, but may be empty)
    INSERT INTO prompt_departments (prompt_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($3::text[]) as dept_id
    WHERE COALESCE(array_length($3::text[], 1), 0) > 0
    ON CONFLICT (prompt_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    prompt_id,
    system_prompt,
    created_at,
    updated_at
FROM update_prompt

