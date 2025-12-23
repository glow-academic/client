-- Update a prompt with department links
-- Parameters: $1=prompt_id, $2=name, $3=description, $4=system_prompt, $5=active, $6=department_ids (text array, nullable), $7=profile_id (uuid)
WITH user_profile AS (
    SELECT 
        p.role
    FROM profiles p
    WHERE p.id = $7::uuid
),
object_current_departments AS (
    -- Get prompt's current active department links
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM prompt_departments
    WHERE prompt_id = $1::uuid AND active = true
),
user_departments AS (
    -- Get user's departments
    SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
    FROM profile_departments
    WHERE profile_id = $7::uuid AND active = true
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
update_prompt AS (
    UPDATE prompts
    SET 
        name = $2,
        description = $3,
        system_prompt = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as prompt_id, name, description, system_prompt, active, created_at, updated_at
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
    FROM UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (prompt_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    prompt_id,
    name,
    description,
    system_prompt,
    active,
    created_at,
    updated_at
FROM update_prompt

