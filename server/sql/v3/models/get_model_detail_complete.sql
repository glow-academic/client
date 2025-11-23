-- Get model detail with department, key, and endpoint information
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid or "guest-profile-id")
-- Returns: model fields + provider enum + department_mapping + key_mapping + base_url

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text = 'guest-profile-id' THEN
                (SELECT id::uuid FROM profiles WHERE role = 'guest' AND default_profile = true ORDER BY created_at DESC LIMIT 1)
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
model_data AS (
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
model_departments_fallback AS (
    SELECT ARRAY[]::text[] as department_ids
    WHERE NOT EXISTS (SELECT 1 FROM model_departments_data WHERE model_id = $1::uuid)
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
model_all_keys AS (
    -- Default keys (no department-specific override)
    SELECT 
        mk.key_id::text as key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        ARRAY[]::text[] as department_ids
    FROM model_keys mk
    JOIN keys k ON k.id = mk.key_id
    WHERE mk.model_id = $1::uuid AND mk.active = true AND k.active = true
    
    UNION ALL
    
    -- Department-specific keys
    SELECT 
        mdk.key_id::text as key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        ARRAY_AGG(mdk.department_id::text) as department_ids
    FROM model_department_keys mdk
    JOIN keys k ON k.id = mdk.key_id
    WHERE mdk.model_id = $1::uuid AND mdk.active = true AND k.active = true
    GROUP BY mdk.key_id, k.name, k.key, k.description, k.active
),
key_mapping_data AS (
    SELECT COALESCE(
        jsonb_object_agg(
            mak.key_id,
            jsonb_build_object(
                'name', mak.name,
                'description', COALESCE(mak.description, ''),
                'key_masked', CASE 
                    WHEN LENGTH(mak.key) > 4 THEN LEFT(mak.key, 4) || '****'
                    ELSE '****'
                END,
                'active', mak.active,
                'department_ids', mak.department_ids
            )
        ) FILTER (WHERE mak.key_id IS NOT NULL),
        '{}'::jsonb
    ) as key_mapping,
    array_agg(mak.key_id ORDER BY mak.name) FILTER (WHERE mak.key_id IS NOT NULL) as key_ids
    FROM (
        SELECT DISTINCT ON (mak.key_id) 
            mak.key_id,
            mak.name,
            mak.key,
            mak.description,
            mak.active,
            mak.department_ids
        FROM model_all_keys mak
        ORDER BY mak.key_id, mak.name
    ) mak
)
SELECT 
    m.*,
    ARRAY['openai', 'gemini', 'custom']::text[] as valid_providers,
    COALESCE(med.base_url, '') as base_url,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(kmd.key_mapping, '{}'::jsonb) as key_mapping,
    COALESCE(kmd.key_ids, ARRAY[]::text[]) as valid_key_ids,
    mdk.key_id as default_key_id
FROM model_data m
CROSS JOIN valid_departments_data vdd
CROSS JOIN key_mapping_data kmd
LEFT JOIN model_endpoint_data med ON true
LEFT JOIN model_departments_data mdd ON true
LEFT JOIN model_departments_fallback mdf ON true
LEFT JOIN model_default_key mdk ON true

