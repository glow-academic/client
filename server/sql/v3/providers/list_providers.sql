-- List providers with endpoint info and permissions
-- Parameters: $1=profileId (uuid or "guest-profile-id")
WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN department_settings sd ON sd.settings_id = s.id AND sd.active = true
             JOIN profile_departments pd ON pd.department_id = sd.department_id AND pd.active = true
             WHERE pd.profile_id = $1::uuid AND sdg.active = true
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
            WHEN $1::text = 'guest-profile-id' THEN
                (SELECT guest_profile_id FROM resolve_guest_profile)
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT role FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
provider_data AS (
    SELECT 
        p.id::text as provider_id,
        p.name,
        p.description,
        p.value,
        p.active,
        p.created_at,
        p.updated_at,
        COALESCE(pe.base_url, '') as base_url,
        CASE 
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Check if provider is used by models
            WHEN EXISTS (SELECT 1 FROM models m WHERE m.provider_id = p.id AND m.active = true) THEN false
            WHEN up.role IN ('admin', 'superadmin') THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM providers p
    LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
    CROSS JOIN user_profile up
),
provider_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', p.value,
                'label', p.name
            ) ORDER BY p.name
        ) FILTER (WHERE p.active = true),
        '[]'::jsonb
    ) as options
    FROM providers p
    WHERE p.active = true
),
status_options_data AS (
    SELECT jsonb_build_array(
        jsonb_build_object('value', 'true', 'label', 'Active'),
        jsonb_build_object('value', 'false', 'label', 'Inactive')
    ) as options
)
SELECT 
    pd.*,
    pod.options as provider_options,
    sod.options as status_options
FROM provider_data pd
CROSS JOIN provider_options_data pod
CROSS JOIN status_options_data sod
ORDER BY pd.created_at DESC

