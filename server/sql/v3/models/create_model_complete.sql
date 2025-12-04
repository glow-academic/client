-- Create model with department, key, and endpoint links in a single transaction
-- Parameters: $1=provider (enum), $2=name, $3=description, $4=active, 
--            $5=department_ids (text array, nullable), 
--            $6=key_id (text, nullable), $7=base_url (text, nullable), $8=profile_id (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
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
new_model AS (
    INSERT INTO models (
        provider,
        name,
        description,
        active
    )
    VALUES ($1::provider, $2, $3, $4)
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
    CROSS JOIN UNNEST($5::text[]) as dept_id
    WHERE COALESCE(array_length($5::text[], 1), 0) > 0
    ON CONFLICT (model_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_key AS (
    -- Link key if provided (default key for model)
    INSERT INTO model_keys (model_id, key_id, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $6::uuid,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $6::text IS NOT NULL AND $6::text != ''
    ON CONFLICT (model_id, key_id) DO UPDATE SET
        active = true,
        updated_at = NOW()
),
link_endpoint AS (
    -- Link endpoint if base_url provided (indicates custom model)
    INSERT INTO model_endpoints (model_id, base_url, active, created_at, updated_at)
    SELECT 
        nm.model_id::uuid,
        $7::text,
        true,
        NOW(),
        NOW()
    FROM new_model nm
    WHERE $7::text IS NOT NULL AND TRIM($7::text) != ''
    ON CONFLICT (model_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT model_id FROM new_model

