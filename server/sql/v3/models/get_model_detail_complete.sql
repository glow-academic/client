-- Get model detail with department, key, and endpoint information
-- Parameters: $1 = model_id (uuid), $2 = profile_id (uuid)
-- Returns: model fields + provider enum + department_mapping + key_mapping + base_url

WITH resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN $2::text IS NULL OR $2::text = '' THEN NULL::uuid
            ELSE $2::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        $2::uuid as profile_id,
        p.first_name || ' ' || p.last_name as actor_name
    FROM profiles p
    WHERE p.id = $2::uuid
),
model_data AS (
    SELECT 
        m.name,
        m.description,
        m.active,
        m.value,
        p.value as provider,
        p.id::text as provider_id,
        p.name as provider_name
    FROM models m
    JOIN providers p ON p.id = m.provider_id
    WHERE m.id = $1::uuid
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT 
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE model_id = $1::uuid AND modality = 'image' AND is_input = false AND active = true
),
model_endpoint_data AS (
    SELECT 
        COALESCE(me.base_url, '') as base_url
    FROM models m
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    WHERE m.id = $1::uuid
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
-- Keys are now linked to providers, not models directly
-- This CTE is kept  but will be empty
model_default_key AS (
    SELECT NULL::text as key_id
    WHERE false
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
    -- Get keys via settings system: settings -> provider -> key
    -- For each department that has this model, get keys from their settings
    SELECT DISTINCT
        spk.key_id::text as key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        ARRAY_AGG(DISTINCT ds.department_id::text) as department_ids
    FROM models m
    JOIN providers p ON p.id = m.provider_id
    JOIN setting_provider_keys spk ON spk.provider_id = p.id AND spk.active = true
    JOIN keys k ON k.id = spk.key_id AND k.active = true
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE m.id = $1::uuid
    AND ds.active = true
    GROUP BY spk.key_id, k.name, k.key, k.description, k.active
    
    UNION ALL
    
    -- General keys (keys without department links that user has access to)
    SELECT DISTINCT
        k.id::text as key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        NULL::text[] as department_ids
    FROM keys k
    CROSS JOIN resolve_profile_id rpi
    WHERE k.active = true
    AND NOT EXISTS (
        -- Exclude keys already included via setting_provider_keys for this model's provider
        SELECT 1 FROM models m2
        JOIN providers p2 ON p2.id = m2.provider_id
        JOIN setting_provider_keys spk2 ON spk2.provider_id = p2.id AND spk2.key_id = k.id AND spk2.active = true
        WHERE m2.id = $1::uuid
    )
    AND (
        -- Include keys with no settings links (general keys)
        NOT EXISTS (
            SELECT 1 FROM setting_provider_keys spk3
            WHERE spk3.key_id = k.id AND spk3.active = true
        )
        OR
        -- Include keys with settings links that match user's departments
        EXISTS (
            SELECT 1 FROM setting_provider_keys spk4
            JOIN settings s4 ON s4.id = spk4.settings_id AND s4.active = true
            JOIN department_settings ds4 ON ds4.settings_id = s4.id AND ds4.active = true
            JOIN user_departments ud ON ud.department_id = ds4.department_id
            WHERE spk4.key_id = k.id AND spk4.active = true
        )
        OR
        -- Superadmin can see all keys
        EXISTS (SELECT 1 FROM resolve_profile_id rpi2 JOIN profiles p ON p.id = rpi2.resolved_profile_id WHERE rpi2.resolved_profile_id = rpi.resolved_profile_id AND p.role = 'superadmin')
    )
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
),
model_temperature_data AS (
    SELECT 
        model_id,
        MIN(temperature) FILTER (WHERE is_upper = false) as temperature_lower,
        MAX(temperature) FILTER (WHERE is_upper = true) as temperature_upper,
        jsonb_agg(DISTINCT temperature::text ORDER BY temperature::text) FILTER (WHERE is_upper = false) as temperature_values
    FROM model_temperature_levels
    WHERE model_id = $1::uuid AND active = true
    GROUP BY model_id
),
model_pricing_data AS (
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'type', mp.pricing_type::text,
                'unit_id', u.id::text,
                'unit_name', u.name,
                'unit_category', u.unit_category::text,
                'price', mp.price
            ) ORDER BY mp.pricing_type, u.name
        ) as pricing
    FROM model_pricing mp
    JOIN units u ON u.id = mp.unit_id
    WHERE mp.model_id = $1::uuid AND mp.active = true AND u.active = true
),
model_modalities_data AS (
    SELECT 
        jsonb_agg(modality::text ORDER BY modality::text) FILTER (WHERE is_input = true) as input_modalities,
        jsonb_agg(modality::text ORDER BY modality::text) FILTER (WHERE is_input = false) as output_modalities
    FROM model_modalities
    WHERE model_id = $1::uuid AND active = true
),
model_reasoning_levels_data AS (
    SELECT 
        jsonb_agg(reasoning_level::text ORDER BY 
            CASE reasoning_level
                WHEN 'none' THEN 1
                WHEN 'minimal' THEN 2
                WHEN 'low' THEN 3
                WHEN 'medium' THEN 4
                WHEN 'high' THEN 5
            END
        ) as reasoning_levels
    FROM model_reasoning_levels
    WHERE model_id = $1::uuid AND active = true
),
model_qualities_data AS (
    SELECT 
        jsonb_agg(quality::text ORDER BY 
            CASE quality
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
            END
        ) as qualities
    FROM model_qualities
    WHERE model_id = $1::uuid AND active = true
),
model_voices_data AS (
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'id', id::text,
                'voice', voice::text
            ) ORDER BY voice::text
        ) as voices
    FROM model_voices
    WHERE model_id = $1::uuid AND active = true
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
    m.*,
    COALESCE(imc.image_model, false) as image_model,
    -- Query providers table for valid providers
    (SELECT ARRAY_AGG(p.id::text ORDER BY p.name) FROM providers p WHERE p.active = true) as valid_provider_ids,
    (SELECT COALESCE(
        jsonb_object_agg(
            p.id::text,
            jsonb_build_object(
                'name', p.name,
                'description', COALESCE(p.description, '')
            )
        ),
        '{}'::jsonb
    ) FROM providers p WHERE p.active = true) as provider_mapping,
    COALESCE(med.base_url, '') as base_url,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(kmd.key_mapping, '{}'::jsonb) as key_mapping,
    COALESCE(kmd.key_ids, ARRAY[]::text[]) as valid_key_ids,
    mdk.key_id as default_key_id,
    COALESCE(mtd.temperature_lower, 0.0) as temperature_lower,
    COALESCE(mtd.temperature_upper, 1.0) as temperature_upper,
    COALESCE(mtd.temperature_values, '[]'::jsonb) as temperature_values,
    COALESCE(mpd.pricing, '[]'::jsonb) as pricing,
    COALESCE(
        jsonb_build_object(
            'input', COALESCE(mmod.input_modalities, '[]'::jsonb),
            'output', COALESCE(mmod.output_modalities, '[]'::jsonb)
        ),
        jsonb_build_object('input', '[]'::jsonb, 'output', '[]'::jsonb)
    ) as modalities,
    COALESCE(mrl.reasoning_levels, '[]'::jsonb) as reasoning_levels,
    COALESCE(mv.voices, '[]'::jsonb) as voices,
    COALESCE(mq.qualities, '[]'::jsonb) as qualities,
    COALESCE(au.units, '[]'::jsonb) as units,
    ap.actor_name
FROM model_data m
CROSS JOIN valid_departments_data vdd
CROSS JOIN key_mapping_data kmd
CROSS JOIN all_units_data au
CROSS JOIN actor_profile ap
LEFT JOIN model_endpoint_data med ON true
LEFT JOIN model_departments_data mdd ON true
LEFT JOIN model_departments_fallback mdf ON true
LEFT JOIN model_default_key mdk ON true
LEFT JOIN model_temperature_data mtd ON true
LEFT JOIN model_pricing_data mpd ON true
LEFT JOIN model_modalities_data mmod ON true
LEFT JOIN model_reasoning_levels_data mrl ON true
LEFT JOIN model_voices_data mv ON true
LEFT JOIN model_qualities_data mq ON true
LEFT JOIN image_model_check imc ON true

