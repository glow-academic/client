-- Delete parameter if items not in use, returning parameter name and usage count
-- Parameters: $1=parameterId, $2=profile_id (uuid or "guest-profile-id")
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
usage_check AS (
    SELECT COUNT(DISTINCT sf.scenario_id) as usage_count
    FROM field_parameters fp
    JOIN scenario_fields sf ON sf.field_id = fp.field_id
    WHERE fp.parameter_id = $1::uuid AND fp.active = true AND sf.active = true
),
parameter_info AS (
    SELECT 
        p.name,
        COALESCE(uc.usage_count, 0) as usage_count
    FROM parameters p
    CROSS JOIN usage_check uc
    WHERE p.id = $1::uuid
),
delete_parameter AS (
    -- Delete parameter (cascade deletes items and parameter_item_departments)
    DELETE FROM parameters
    WHERE id = $1::uuid
        AND (SELECT usage_count FROM usage_check) = 0
    RETURNING name
)
SELECT 
    pi.name,
    pi.usage_count
FROM parameter_info pi
LEFT JOIN delete_parameter dp ON dp.name = pi.name

