-- Get default model detail for creation with department and key mappings
-- Parameters: $1 = profile_id (uuid or "guest-profile-id")
-- Returns: valid_providers (enum array), department_mapping, key_mapping, valid_*_ids

WITH resolve_guest_profile AS (
    -- Resolve guest-profile-id using settings system (department-specific or default)
    SELECT 
        COALESCE(
            -- Department-specific settings guest profile (if user has departments)
            (SELECT sdg.profile_id FROM settings_default_guest sdg
             JOIN settings s ON s.id = sdg.settings_id AND s.active = true
             JOIN settings_departments sd ON sd.settings_id = s.id AND sd.active = true
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
),
user_departments_data AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE d.active = true
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
valid_departments_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ud.id::text,
                jsonb_build_object(
                    'name', ud.name,
                    'description', COALESCE(ud.description, '')
                )
            ),
            '{}'::jsonb
        ) as dept_mapping,
        array_agg(ud.id::text ORDER BY ud.name) as dept_ids
    FROM user_departments_data ud
),
valid_models AS (
    -- Filter models by department: include if has matching department link OR has no department links at all (cross-dept)
    SELECT 
        m.id::text as model_id,
        m.name,
        COALESCE(m.description, '') as description,
        m.active
    FROM models m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE m.active = true
    GROUP BY m.id, m.name, m.description, m.active
    HAVING 
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY m.name
),
valid_keys AS (
    -- Get all active keys (no model-specific filtering for default view)
    SELECT DISTINCT k.id::text as key_id, k.name, k.key, k.description, k.active
    FROM keys k
    WHERE k.active = true
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            vk.key_id,
            jsonb_build_object(
                'name', vk.name,
                'description', COALESCE(vk.description, ''),
                'key_masked', CASE 
                    WHEN LENGTH(vk.key) > 4 THEN LEFT(vk.key, 4) || '****'
                    ELSE '****'
                END,
                'active', vk.active,
                'department_ids', NULL::text[]
            )
        ) FILTER (WHERE vk.key_id IS NOT NULL),
        '{}'::jsonb
    ) as key_mapping,
    array_agg(vk.key_id ORDER BY vk.name) as key_ids
    FROM valid_keys vk
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
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
all_units_data AS (
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'id', id::text,
                'name', name,
                'unit_category', unit_category::text,
                'value', value
            ) ORDER BY unit_category, value, name
        ) as units
    FROM units
    WHERE active = true
)
SELECT 
    ARRAY['openai', 'gemini', 'custom']::text[] as valid_providers,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(
        (SELECT jsonb_object_agg(
            vm.model_id,
            jsonb_build_object('name', vm.name, 'description', vm.description)
        )
        FROM valid_models vm),
        '{}'::jsonb
    ) as model_mapping,
    COALESCE(
        (SELECT jsonb_agg(vm.model_id ORDER BY vm.name)
        FROM valid_models vm),
        '[]'::jsonb
    ) as valid_model_ids,
    COALESCE(kmd.key_mapping, '{}'::jsonb) as key_mapping,
    COALESCE(kmd.key_ids, ARRAY[]::text[]) as valid_key_ids,
    COALESCE(au.units, '[]'::jsonb) as units,
    pr.user_role,
    pdi.department_id as primary_department_id
FROM valid_departments_data vdd
CROSS JOIN key_mapping_data kmd
CROSS JOIN profile_data pr
CROSS JOIN all_units_data au
LEFT JOIN primary_department_id pdi ON true

