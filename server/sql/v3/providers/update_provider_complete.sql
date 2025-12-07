-- Update provider with optional endpoint in a single transaction
-- Parameters: $1=provider_id, $2=name, $3=description, $4=value, $5=active, $6=base_url (text, nullable), $7=profile_id (uuid or "guest-profile-id")
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
update_provider AS (
    UPDATE providers
    SET 
        name = $2,
        description = $3,
        value = $4,
        active = $5,
        updated_at = NOW()
    WHERE id = $1::uuid
    RETURNING id::text as provider_id
),
update_endpoint AS (
    -- Update or create endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        $1::uuid,
        $6::text,
        true,
        NOW(),
        NOW()
    WHERE $6::text IS NOT NULL AND TRIM($6::text) != ''
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
),
delete_endpoint AS (
    -- Delete endpoint if base_url is empty/null
    UPDATE provider_endpoints
    SET active = false, updated_at = NOW()
    WHERE provider_id = $1::uuid
    AND ($6::text IS NULL OR TRIM($6::text) = '')
)
SELECT provider_id FROM update_provider

