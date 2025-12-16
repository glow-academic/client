-- Create department with settings relationship in single query (DHH style)
-- Parameters: $1=title, $2=description, $3=active, $4=settings_id (text, nullable), $5=profile_id (uuid or "guest-profile-id")
-- Returns: id, actor_name

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $5::uuid AND sdg.active = true
             LIMIT 1),
            -- Fallback to default (active) settings guest profile
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             WHERE sdg.active = true
             LIMIT 1)
        ) as guest_profile_id
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $5::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $5::text IS NULL OR $5::text = '' THEN NULL::uuid
            ELSE $5::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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

