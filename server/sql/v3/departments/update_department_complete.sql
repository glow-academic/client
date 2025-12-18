-- Update department with settings relationship in single query (DHH style)
-- Parameters: $1=department_id (uuid), $2=title, $3=description, $4=active, $5=settings_id (text, nullable), $6=current_profile_id (uuid)
-- Returns: id, title, actor_name

WITH actor_profile AS (
    SELECT 
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $6::uuid
),
department_update AS (
    -- Update department
    UPDATE departments SET
        title = $2,
        description = $3,
        active = $4,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id, title
),
remove_existing_settings AS (
    -- Remove existing settings link if settingsId is null or different
    DELETE FROM department_settings
    WHERE department_id = $1::uuid
      AND ($5 IS NULL OR settings_id != $5::uuid)
),
link_settings AS (
    -- Link settings if provided
    INSERT INTO department_settings (settings_id, department_id, active, created_at, updated_at)
    SELECT 
        $5::uuid,
        du.id,
        true,
        NOW(),
        NOW()
    FROM department_update du
    WHERE $5 IS NOT NULL
    ON CONFLICT (settings_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
-- Return updated department info
SELECT 
    du.id, 
    du.title,
    ap.actor_name
FROM department_update du
CROSS JOIN actor_profile ap

