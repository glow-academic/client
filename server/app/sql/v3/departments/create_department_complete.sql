-- Create department with settings relationship in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=settings_id (text, nullable), $5=profile_id (uuid, required)
-- Returns: id, actor_name
-- profile_id is always a UUID (required in request body)
WITH actor_profile AS (
    SELECT 
        $5::uuid as resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $5::uuid
),
new_department AS (
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
link_settings AS (
    -- Link settings if provided
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        $4::uuid,
        nd.id,
        true,
        NOW(),
        NOW()
    FROM new_department nd
    WHERE $4 IS NOT NULL
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return department ID and actor name
SELECT 
    nd.id::text as department_id,
    ap.actor_name
FROM new_department nd
CROSS JOIN actor_profile ap

