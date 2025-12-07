-- List keys with department relationships, model relationships, and permissions
-- Parameters: $1=profileId
WITH user_departments AS (
    SELECT department_id
    FROM profile_departments
    WHERE profile_id = $1 AND active = true
),
user_profile AS (
    SELECT role FROM profiles WHERE id = $1
),
-- Get department_ids via provider_keys -> providers -> setting_providers -> settings -> department_settings
key_departments_data AS (
    SELECT 
        pk.key_id,
        ARRAY_AGG(DISTINCT ds.department_id::text ORDER BY ds.department_id) as department_ids
    FROM provider_keys pk
    JOIN providers p ON p.id = pk.provider_id
    JOIN setting_providers sp ON sp.provider_id = p.id AND sp.active = true
    JOIN settings s ON s.id = sp.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE pk.active = true
    GROUP BY pk.key_id
),
-- Get model_ids via provider_keys -> providers -> models
key_models_data AS (
    SELECT 
        pk.key_id,
        ARRAY_AGG(m.id::text ORDER BY m.name) as model_ids
    FROM provider_keys pk
    JOIN providers p ON p.id = pk.provider_id
    JOIN models m ON m.provider_id = p.id
    WHERE pk.active = true AND m.active = true
    GROUP BY pk.key_id
),
key_data AS (
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
        k.updated_at,
        COALESCE(kdd.department_ids, NULL) as department_ids,
        COALESCE(kmd.model_ids, ARRAY[]::text[]) as model_ids,
        CASE 
            -- Default keys (no department_ids) are read-only for non-superadmin
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                -- Check if key is linked to providers that are linked to user's department settings
                EXISTS (
                    SELECT 1 FROM provider_keys pk
                    JOIN providers p ON p.id = pk.provider_id
                    JOIN setting_providers sp ON sp.provider_id = p.id AND sp.active = true
                    JOIN settings s ON s.id = sp.settings_id AND s.active = true
                    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                    JOIN user_departments ud ON ud.department_id = ds.department_id
                    WHERE pk.key_id = k.id AND pk.active = true
                )
                OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
            ) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                EXISTS (
                    SELECT 1 FROM provider_keys pk
                    JOIN providers p ON p.id = pk.provider_id
                    JOIN setting_providers sp ON sp.provider_id = p.id AND sp.active = true
                    JOIN settings s ON s.id = sp.settings_id AND s.active = true
                    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
                    JOIN user_departments ud ON ud.department_id = ds.department_id
                    WHERE pk.key_id = k.id AND pk.active = true
                )
                OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
            ) THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM keys k
    LEFT JOIN key_departments_data kdd ON kdd.key_id = k.id
    LEFT JOIN key_models_data kmd ON kmd.key_id = k.id
    CROSS JOIN user_profile up
    WHERE 
        -- Include keys with matching department links OR default keys (no department links)
        EXISTS (
            SELECT 1 FROM provider_keys pk
            JOIN providers p ON p.id = pk.provider_id
            JOIN setting_providers sp ON sp.provider_id = p.id AND sp.active = true
            JOIN settings s ON s.id = sp.settings_id AND s.active = true
            JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
            JOIN user_departments ud ON ud.department_id = ds.department_id
            WHERE pk.key_id = k.id AND pk.active = true
        )
        OR NOT EXISTS (SELECT 1 FROM key_departments_data kdd2 WHERE kdd2.key_id = k.id)
        OR up.role = 'superadmin'
),
all_department_ids AS (
    SELECT DISTINCT unnest(department_ids)::uuid as department_id
    FROM key_departments_data
    WHERE department_ids IS NOT NULL
),
department_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            d.id::text,
            jsonb_build_object(
                'name', d.title,
                'description', COALESCE(d.description, '')
            )
        ) FILTER (WHERE d.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
),
all_model_ids AS (
    SELECT DISTINCT unnest(model_ids)::uuid as model_id
    FROM key_models_data
    WHERE model_ids IS NOT NULL
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
    FROM models m
    JOIN providers p ON p.id = m.provider_id
    WHERE m.id IN (SELECT model_id FROM all_model_ids)
),
-- Build facet options for filters
department_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', d.id::text,
                'label', d.title
            ) ORDER BY d.title
        ) FILTER (WHERE d.id IS NOT NULL),
        '[]'::jsonb
    ) as options
    FROM departments d
    WHERE d.id IN (SELECT department_id FROM all_department_ids)
        OR d.id IN (SELECT department_id FROM user_departments)
),
model_options_data AS (
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'value', m.id::text,
                'label', m.name
            ) ORDER BY m.name
        ) FILTER (WHERE m.id IS NOT NULL),
        '[]'::jsonb
    ) as options
    FROM models m
    WHERE m.id IN (SELECT model_id FROM all_model_ids)
)
SELECT 
    kd.*,
    dmd.mapping as department_mapping,
    mmd.mapping as model_mapping,
    dod.options as department_options,
    mod.options as model_options
FROM key_data kd
CROSS JOIN department_mapping_data dmd
CROSS JOIN model_mapping_data mmd
CROSS JOIN department_options_data dod
CROSS JOIN model_options_data mod
ORDER BY kd.created_at DESC
