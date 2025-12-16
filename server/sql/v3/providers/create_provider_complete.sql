-- Create provider with optional endpoint in a single transaction
-- Parameters: $1=name, $2=description, $3=value, $4=active, $5=base_url (text, nullable), $6=profile_id (uuid or "guest-profile-id")
-- Returns: provider_id, actor_name
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
new_provider AS (
    INSERT INTO providers (
        name,
        description,
        value,
        active
    )
    VALUES ($1, $2, $3, $4)
    RETURNING id::text as provider_id
),
link_endpoint AS (
    -- Link endpoint if base_url provided
    INSERT INTO provider_endpoints (provider_id, base_url, active, created_at, updated_at)
    SELECT 
        np.provider_id::uuid,
        $5::text,
        true,
        NOW(),
        NOW()
    FROM new_provider np
    WHERE $5::text IS NOT NULL AND TRIM($5::text) != ''
    ON CONFLICT (provider_id) DO UPDATE SET
        base_url = EXCLUDED.base_url,
        active = true,
        updated_at = NOW()
)
SELECT 
    np.provider_id,
    ap.actor_name
FROM new_provider np
CROSS JOIN actor_profile ap

