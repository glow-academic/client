-- Create field with conditional parameters and department links
-- Parameters: $1=name, $2=description, $3=active, $4=department_ids (nullable text array), $5=conditional_parameter_ids (nullable text array), $6=profile_id (uuid or "guest-profile-id")
-- Returns: field_id, actor_name
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $6::uuid AND sdg.active = true
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
            WHEN $6::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $6::text IS NULL OR $6::text = '' THEN NULL::uuid
            ELSE $6::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
new_field AS (
    INSERT INTO fields (
        name,
        description,
        active
    )
    VALUES ($1, $2, COALESCE($3, true))
    RETURNING id::text as field_id
),
link_conditional_parameters AS (
    -- Link field to conditional parameters if provided
    INSERT INTO field_conditional_parameters (field_id, conditional_parameter_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        cond_param_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($5::text[], ARRAY[]::text[])) as cond_param_id
    WHERE $5 IS NOT NULL AND array_length($5::text[], 1) > 0
    ON CONFLICT (field_id, conditional_parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_departments AS (
    -- Link field to departments if provided
    INSERT INTO field_departments (field_id, department_id, active, created_at, updated_at)
    SELECT 
        nf.field_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_field nf
    CROSS JOIN UNNEST(COALESCE($4::text[], ARRAY[]::text[])) as dept_id
    WHERE $4 IS NOT NULL AND array_length($4::text[], 1) > 0
    ON CONFLICT (field_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT 
    nf.field_id,
    ap.actor_name
FROM new_field nf
CROSS JOIN actor_profile ap

