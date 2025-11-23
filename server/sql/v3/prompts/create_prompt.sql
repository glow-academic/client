-- Create a new prompt with department links
-- Parameters: $1=name, $2=description, $3=system_prompt, $4=active, $5=department_ids (text array, nullable), $6=profile_id (uuid or "guest-profile-id")
WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $6::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $6::text IS NULL OR $6::text = '' THEN NULL::uuid
            ELSE $6::uuid
        END as resolved_profile_id
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

