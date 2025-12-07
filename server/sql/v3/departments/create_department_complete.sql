-- Create department with settings relationship in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=settings_id (text, nullable)
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
-- Return department ID
SELECT id::text as department_id FROM new_department

