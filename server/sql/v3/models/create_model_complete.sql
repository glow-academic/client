-- Create model with department links and endpoint in a single transaction
-- Parameters: $1=provider_id (uuid), $2=name, $3=description, $4=active, 
--            $5=value (text), $6=department_ids (text array, nullable), 
--            $7=base_url (text, nullable), $8=profile_id (uuid or "guest-profile-id")
-- Returns: model_id, actor_name
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
actor_profile AS (
    SELECT 
        rpi.resolved_profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
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
),
create_endpoint AS (
    -- Create model endpoint if base_url is provided
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $7::text,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $7 IS NOT NULL AND TRIM($7) != ''
    ON CONFLICT (model_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT 
    nm.model_id as id,
    ap.actor_name
FROM new_model nm
CROSS JOIN actor_profile ap

