-- Create a new prompt with department links
-- Parameters: $1=name, $2=description, $3=system_prompt, $4=active, $5=department_ids (text array, nullable), $6=profile_id (uuid)
WITH user_profile AS (
    SELECT 
        p.role
    FROM profiles p
    WHERE p.id = $6::uuid
),
validate_create_permissions AS (
    -- Validate department permissions for create operation
    SELECT validate_department_create_permissions(
        up.role,
        $5::text[]
    ) as validation_passed
    FROM user_profile up
),
new_prompt AS (
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

