-- Get key detail with department relationships, model relationships, and permissions
-- Parameters: $1=keyId (uuid), $2=profileId (uuid)
WITH key_data AS (
    SELECT 
        k.id as key_id,
        k.name,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        k.description,
        k.active,
        k.created_at,
        k.updated_at
    FROM keys k
    WHERE k.id = $1::uuid
),
-- Get department_ids via setting_provider_keys -> settings -> department_settings
key_departments_data AS (
    SELECT 
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id::text) as department_ids
    FROM setting_provider_keys spk
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE spk.key_id = $1::uuid AND spk.active = true
),
-- Get model_ids via setting_provider_keys -> providers -> models
key_models_data AS (
    SELECT 
        ARRAY_AGG(m.id::text ORDER BY m.name) as model_ids
    FROM setting_provider_keys spk
    JOIN providers p ON p.id = spk.provider_id
    JOIN models m ON m.provider_id = p.id
    WHERE spk.key_id = $1::uuid AND spk.active = true AND m.active = true
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
user_has_key_access AS (
    -- Check if user has access to key via setting_provider_keys -> settings -> department_settings
    SELECT EXISTS(
        SELECT 1 FROM setting_provider_keys spk
        JOIN settings s ON s.id = spk.settings_id AND s.active = true
        JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
        JOIN resolve_profile_id rpi ON true
        JOIN profile_departments pd ON pd.department_id = ds.department_id
        WHERE spk.key_id = $1::uuid AND spk.active = true
        AND pd.profile_id = rpi.resolved_profile_id AND pd.active = true
    ) OR EXISTS(
        SELECT 1 FROM resolve_profile_id rpi
        JOIN profiles p ON p.id = rpi.resolved_profile_id
        WHERE p.role = 'superadmin'
    ) OR (
        -- Default keys (no department links via settings) are accessible to all admins
        NOT EXISTS (
            SELECT 1 FROM setting_provider_keys spk
            JOIN settings s ON s.id = spk.settings_id AND s.active = true
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            WHERE spk.key_id = $1::uuid AND spk.active = true
        )
    ) as has_access
),
model_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            m.id::text,
            jsonb_build_object(
                'name', m.name,
                'description', COALESCE(m.description, ''),
                'provider', p.value,
                'active', m.active
            )
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM setting_provider_keys spk
    JOIN providers p ON p.id = spk.provider_id
    JOIN models m ON m.provider_id = p.id
    WHERE spk.key_id = $1::uuid AND spk.active = true AND m.active = true
)
SELECT 
    kd.*,
    COALESCE(kdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(kmd.model_ids, ARRAY[]::text[]) as model_ids,
    vd.dept_mapping as department_mapping,
    vd.dept_ids as valid_department_ids,
    pr.user_role,
    mmd.mapping as model_mapping,
    CASE 
        -- Default keys (no department_ids via settings) are read-only for non-superadmin
        WHEN (COALESCE(kdd.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND pr.user_role != 'superadmin') THEN false
        WHEN pr.user_role = 'superadmin' THEN true
        WHEN pr.user_role = 'admin' AND uhka.has_access THEN true
        ELSE false
    END as can_edit
FROM key_data kd
LEFT JOIN key_departments_data kdd ON true
LEFT JOIN key_models_data kmd ON true
CROSS JOIN valid_depts vd
CROSS JOIN profile_data pr
CROSS JOIN user_has_key_access uhka
CROSS JOIN model_mapping_data mmd
WHERE uhka.has_access = true

