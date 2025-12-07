-- Get default prompt structure for new prompt creation
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
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
valid_depts AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                d.id::text,
                jsonb_build_object(
                    'name', d.title,
                    'description', COALESCE(d.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(d.id::text ORDER BY d.title) as dept_ids
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE pd.profile_id = rpi.resolved_profile_id AND d.active = true AND pd.active = true
),
profile_data AS (
    SELECT role as user_role 
    FROM resolve_profile_id rpi
    JOIN profiles p ON p.id = rpi.resolved_profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.is_primary = TRUE AND pd.active = true
    LIMIT 1
)
SELECT 
    '' as prompt_id,
    '' as name,
    '' as description,
    '' as system_prompt,
    true as active,
    NOW() as created_at,
    NOW() as updated_at,
    -- Set default department_ids based on role
    -- Superadmin: NULL (empty = all departments = default object)
    -- Non-superadmin: [primaryDepartmentId] if available
    CASE 
        WHEN pr.user_role = 'superadmin' THEN NULL
        WHEN pd.department_id IS NOT NULL THEN ARRAY[pd.department_id]
        ELSE ARRAY[]::text[]
    END as department_ids,
    ARRAY[]::text[] as agent_ids,
    ARRAY[]::text[] as persona_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    pd.department_id,
    '{}'::jsonb as agent_mapping,
    '{}'::jsonb as persona_mapping,
    -- Default prompts (empty department_ids) are read-only for non-superadmin
    CASE 
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND pd.department_id IS NOT NULL THEN true
        ELSE false
    END as can_edit
FROM valid_depts vd
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pd ON true

