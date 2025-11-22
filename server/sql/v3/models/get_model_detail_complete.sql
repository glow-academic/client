-- Get model detail with department, key, and endpoint information
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid)
-- Returns: model fields + provider enum + department_mapping + key_mapping + base_url

WITH model_data AS (
    SELECT 
        name,
        description,
        active,
        image_model,
        input_ppm,
        output_ppm,
        provider::text as provider
    FROM models
    WHERE id = $1::uuid
),
model_endpoint_data AS (
    SELECT 
        me.base_url
    FROM model_endpoints me
    WHERE me.model_id = $1::uuid AND me.active = true
    LIMIT 1
),
model_departments_data AS (
    SELECT 
        md.model_id,
        ARRAY_AGG(md.department_id::text ORDER BY md.created_at) as department_ids
    FROM model_departments md
    WHERE md.model_id = $1::uuid AND md.active = true
    GROUP BY md.model_id
),
model_default_key AS (
    SELECT 
        mk.key_id::text as key_id
    FROM model_keys mk
    WHERE mk.model_id = $1::uuid AND mk.active = true
    LIMIT 1
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM profile_departments pd
    WHERE pd.profile_id = $2::uuid
),
user_departments_data AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE d.active = true
    AND pd.profile_id = $2::uuid
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
)
SELECT 
    m.*,
    ARRAY['openai', 'gemini', 'custom']::text[] as valid_providers,
    COALESCE(med.base_url, '') as base_url,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(mdd.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(kmd.key_mapping, '{}'::jsonb) as key_mapping,
    COALESCE(kmd.key_ids, ARRAY[]::text[]) as valid_key_ids,
    mdk.key_id as default_key_id
FROM model_data m
CROSS JOIN valid_departments_data vdd
CROSS JOIN key_mapping_data kmd
LEFT JOIN model_endpoint_data med ON true
LEFT JOIN model_departments_data mdd ON mdd.model_id = $1::uuid
LEFT JOIN model_default_key mdk ON true

