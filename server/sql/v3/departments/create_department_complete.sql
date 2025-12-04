-- Create department with profiles in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=profile_ids (text[])
-- Returns: id

WITH new_department AS (
    -- Create department
    INSERT INTO departments (
        title,
        description,
        active,
        created_at,
        updated_at
    )
    VALUES ($1, $2, $3, NOW(), NOW())
    RETURNING id
),
link_profiles AS (
    -- Link profiles if provided (array may be empty)
    INSERT INTO profile_departments (profile_id, department_id, is_primary, active, created_at, updated_at)
    SELECT 
        profile_id::uuid,
        nd.id,
        (ROW_NUMBER() OVER (ORDER BY profile_id) = 1) as is_primary,  -- First profile gets primary
        true,
        NOW(),
        NOW()
    FROM new_department nd
    CROSS JOIN UNNEST($4::text[]) as profile_id
    WHERE COALESCE(array_length($4::text[], 1), 0) > 0
    ON CONFLICT (profile_id, department_id) DO UPDATE SET
        is_primary = EXCLUDED.is_primary,
        active = true,
        updated_at = NOW()
)
-- Return department ID
SELECT id::text as department_id FROM new_department

