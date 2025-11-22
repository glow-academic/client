-- Get default model detail for creation with department and key mappings
-- Parameters: $1 = profile_id (uuid)
-- Returns: provider_mapping, department_mapping, key_mapping, valid_*_ids

WITH user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $1::uuid
),
valid_providers AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                p.id::text,
                jsonb_build_object(
                    'name', p.name,
                    'description', COALESCE(p.description, '')
                )
            ),
            '{}'::jsonb
        ) as provider_mapping,
        array_agg(p.id::text ORDER BY p.name) as provider_ids
    FROM providers p
),
user_departments_data AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE d.active = true
    AND pd.profile_id = $1::uuid
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
    -- Get all API keys (default + department-specific for user's departments)
    SELECT DISTINCT k.id::text as key_id, k.name, k.key, k.active
    FROM keys k
    WHERE k.type = 'api' AND k.active = true
    UNION
    -- Also include department-specific keys for user's departments
    SELECT DISTINCT k.id::text as key_id, k.name, k.key, k.active
    FROM keys k
    JOIN model_department_keys mdk ON mdk.key_id = k.id AND mdk.active = true
    WHERE k.type = 'api' AND k.active = true
    AND mdk.department_id IN (SELECT department_id FROM user_departments)
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            vk.key_id,
            jsonb_build_object(
                'name', vk.name,
                'description', CASE 
                    WHEN LENGTH(vk.key) > 4 THEN LEFT(vk.key, 4) || '****'
                    ELSE '****'
                END,
                'key_masked', CASE 
                    WHEN LENGTH(vk.key) > 4 THEN LEFT(vk.key, 4) || '****'
                    ELSE '****'
                END,
                'active', vk.active
            )
        ) FILTER (WHERE vk.key_id IS NOT NULL),
        '{}'::jsonb
    ) as key_mapping,
    array_agg(vk.key_id ORDER BY vk.name) as key_ids
    FROM valid_keys vk
),
profile_data AS (
    SELECT role as user_role 
    FROM profiles 
    WHERE id = $1::uuid
),
primary_department_id AS (
    SELECT department_id::text
    FROM profile_departments
    WHERE profile_id = $1::uuid AND is_primary = TRUE
    LIMIT 1
)
SELECT 
    vp.provider_mapping,
    vp.provider_ids as valid_provider_ids,
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
    pr.user_role,
    pdi.department_id as primary_department_id
FROM valid_providers vp
CROSS JOIN valid_departments_data vdd
CROSS JOIN key_mapping_data kmd
CROSS JOIN profile_data pr
LEFT JOIN primary_department_id pdi ON true

