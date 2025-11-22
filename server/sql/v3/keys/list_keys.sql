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
key_departments_data AS (
    SELECT 
        kd.key_id,
        ARRAY_AGG(kd.department_id::text ORDER BY kd.created_at) as department_ids
    FROM key_departments kd
    WHERE kd.active = true
    GROUP BY kd.key_id
),
key_models_data AS (
    SELECT 
        mk.key_id,
        ARRAY_AGG(mk.model_id::text ORDER BY m.name) as model_ids
    FROM model_keys mk
    JOIN models m ON m.id = mk.model_id
    WHERE mk.active = true AND m.active = true
    GROUP BY mk.key_id
),
key_data AS (
    SELECT 
        k.id as key_id,
        k.name,
        CASE 
            WHEN LENGTH(k.key) > 4 THEN LEFT(k.key, 4) || '****'
            ELSE '****'
        END as key_masked,
        k.type::text as type,
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
                COUNT(kd.key_id) FILTER (WHERE kd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM key_departments kd2 WHERE kd2.key_id = k.id AND kd2.active = true)
            ) THEN true
            ELSE false
        END as can_edit,
        CASE 
            -- Can't delete if can't edit
            WHEN COALESCE(kdd.department_ids, NULL) IS NULL AND up.role != 'superadmin' THEN false
            WHEN up.role = 'superadmin' THEN true
            WHEN up.role = 'admin' AND (
                COUNT(kd.key_id) FILTER (WHERE kd.department_id IN (SELECT department_id FROM user_departments)) > 0
                OR NOT EXISTS (SELECT 1 FROM key_departments kd2 WHERE kd2.key_id = k.id AND kd2.active = true)
            ) THEN true
            ELSE false
        END as can_delete,
        true as can_duplicate
    FROM keys k
    LEFT JOIN key_departments kd ON kd.key_id = k.id AND kd.active = true
    LEFT JOIN key_departments_data kdd ON kdd.key_id = k.id
    LEFT JOIN key_models_data kmd ON kmd.key_id = k.id
    CROSS JOIN user_profile up
    GROUP BY k.id, k.name, k.key, k.type, k.active, k.created_at, k.updated_at, kdd.department_ids, kmd.model_ids, up.role
    HAVING 
        -- Include keys with matching department links OR default keys (no department links)
        COUNT(kd.key_id) FILTER (WHERE kd.department_id IN (SELECT department_id FROM user_departments)) > 0
        OR NOT EXISTS (SELECT 1 FROM key_departments kd2 WHERE kd2.key_id = k.id AND kd2.active = true)
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
                'provider', m.provider::text,
                'active', m.active
            )
        ) FILTER (WHERE m.id IS NOT NULL),
        '{}'::jsonb
    ) as mapping
    FROM models m
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
type_options_data AS (
    SELECT jsonb_agg(
        jsonb_build_object(
            'value', type_val,
            'label', CASE 
                WHEN type_val = 'api' THEN 'API'
                WHEN type_val = 'auth' THEN 'Auth'
                ELSE type_val
            END
        )
    ) as options
    FROM (SELECT DISTINCT type::text as type_val FROM keys) t
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
    tod.options as type_options,
    mod.options as model_options
FROM key_data kd
CROSS JOIN department_mapping_data dmd
CROSS JOIN model_mapping_data mmd
CROSS JOIN department_options_data dod
CROSS JOIN type_options_data tod
CROSS JOIN model_options_data mod
ORDER BY kd.created_at DESC
