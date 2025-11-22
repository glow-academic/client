-- Create a new prompt with department links
-- Parameters: $1=system_prompt, $2=department_ids (text array, nullable)
WITH new_prompt AS (
    INSERT INTO prompts (
        system_prompt,
        created_at,
        updated_at
    )
    VALUES ($1, NOW(), NOW())
    RETURNING id::text as prompt_id
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO prompt_departments (prompt_id, department_id, active, created_at, updated_at)
    SELECT 
        np.prompt_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_prompt np
    CROSS JOIN UNNEST($2::text[]) as dept_id
    WHERE COALESCE(array_length($2::text[], 1), 0) > 0
    ON CONFLICT (prompt_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    np.prompt_id,
    pr.system_prompt,
    pr.created_at,
    pr.updated_at
FROM new_prompt np
JOIN prompts pr ON pr.id = np.prompt_id::uuid

