-- Update model with department links in a single transaction
-- Parameters: $1=model_id, $2=provider_id (uuid), $3=name, $4=description, $5=active, 
--            $6=value (text), $7=department_ids (text array, nullable), 
--            $8=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $8::uuid AND sdg.active = true
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
            WHEN $8::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $8::text IS NULL OR $8::text = '' THEN NULL::uuid
            ELSE $8::uuid
        END as resolved_profile_id
),
update_model AS (
    UPDATE models SET
        provider_id = $2::uuid,
        name = $3,
        description = $4,
        active = $5,
        value = $6,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as model_id
),
deactivate_all_departments AS (
    -- Deactivate all existing department links
    UPDATE model_departments
    SET active = false, updated_at = NOW()
    WHERE model_id = $1::uuid AND active = true
),
link_departments AS (
    -- Link departments if provided (array is never NULL, but may be empty)
    INSERT INTO model_departments (model_id, department_id, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        dept_id::uuid,
        true,
        NOW(),
        NOW()
    FROM UNNEST($7::text[]) as dept_id
    WHERE COALESCE(array_length($7::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
)
SELECT model_id FROM update_model

