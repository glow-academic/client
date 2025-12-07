-- Delete provider (cascade deletes provider_endpoints, provider_keys)
-- Parameters: $1=providerId (uuid), $2=profileId (uuid or "guest-profile-id")
-- Returns: provider_id if deletion successful
-- Prevents deletion if provider is used by models
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $2::uuid AND sdg.active = true
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
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
check_usage AS (
    -- Check if provider is used by models
    SELECT EXISTS(
        SELECT 1 FROM models m 
        WHERE m.provider_id = $1::uuid AND m.active = true
    ) as is_used
),
check_permissions AS (
    SELECT 
        CASE 
            WHEN cu.is_used THEN false
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_delete
    FROM user_profile up
    CROSS JOIN check_usage cu
),
delete_provider AS (
    DELETE FROM providers
    WHERE id = $1::uuid
    AND EXISTS (SELECT 1 FROM check_permissions WHERE can_delete = true)
    AND NOT EXISTS (SELECT 1 FROM check_usage WHERE is_used = true)
    RETURNING id::text as provider_id
)
SELECT provider_id FROM delete_provider

