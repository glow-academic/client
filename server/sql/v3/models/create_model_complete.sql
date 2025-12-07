-- Create model with department links in a single transaction
-- Parameters: $1=provider_id (uuid), $2=name, $3=description, $4=active, 
--            $5=value (text), $6=department_ids (text array, nullable), 
--            $7=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $7::uuid AND sdg.active = true
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
            WHEN $7::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $7::text IS NULL OR $7::text = '' THEN NULL::uuid
            ELSE $7::uuid
        END as resolved_profile_id
),
new_model AS (
    INSERT INTO models (
        provider_id,
        name,
        description,
        active,
        value
    )
    VALUES ($1::uuid, $2, $3, $4, $5)
    RETURNING id::text as model_id
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    CROSS JOIN UNNEST($6::text[]) as dept_id
    WHERE COALESCE(array_length($6::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT model_id FROM new_model

