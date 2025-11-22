-- Create a new prompt with department links
-- Parameters: $1=name, $2=description, $3=system_prompt, $4=active, $5=department_ids (text array, nullable)
WITH new_prompt AS (
    INSERT INTO prompts (
        name,
        description,
        system_prompt,
        active,
        created_at,
        updated_at
    )
    VALUES ($1, $2, $3, $4, NOW(), NOW())
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
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (prompt_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    np.prompt_id,
    pr.name,
    pr.description,
    pr.system_prompt,
    pr.active,
    pr.created_at,
    pr.updated_at
FROM new_prompt np
JOIN prompts pr ON pr.id = np.prompt_id::uuid

