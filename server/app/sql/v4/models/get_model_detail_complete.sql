-- Get model detail with department, key, and endpoint information
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_model_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_detail_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_model_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_model_detail_v4_provider AS (
    provider_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_detail_v4_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_detail_v4_key AS (
    key_id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    department_ids uuid[]
);

CREATE TYPE types.q_get_model_detail_v4_pricing AS (
    pricing_type text,
    unit_id uuid,
    unit_name text,
    unit_category text,
    price float
);

CREATE TYPE types.q_get_model_detail_v4_unit AS (
    unit_id uuid,
    name text,
    unit_category text,
    value int
);

CREATE TYPE types.q_get_model_detail_v4_modalities AS (
    input text[],
    output text[]
);

CREATE TYPE types.q_get_model_detail_v4_voice AS (
    voice_id uuid,
    voice text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_model_detail_v4(
    model_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    model_exists boolean,
    name text,
    description text,
    active boolean,
    image_model boolean,
    provider text,
    provider_id uuid,
    provider_name text,
    value text,
    base_url text,
    valid_provider_ids uuid[],
    providers types.q_get_model_detail_v4_provider[],
    valid_department_ids uuid[],
    departments types.q_get_model_detail_v4_department[],
    department_ids uuid[],
    valid_key_ids uuid[],
    keys types.q_get_model_detail_v4_key[],
    default_key_id uuid,
    temperature_lower float,
    temperature_upper float,
    temperature_values text[],
    pricing types.q_get_model_detail_v4_pricing[],
    modalities types.q_get_model_detail_v4_modalities,
    reasoning_levels text[],
    voices types.q_get_model_detail_v4_voice[],
    qualities text[],
    units types.q_get_model_detail_v4_unit[],
    actor_name text,
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        model_id AS model_id,
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        d.payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    AND d.resource_type = 'models'::draft_resource_type
    LIMIT 1
),
model_exists_check AS (
    SELECT EXISTS(SELECT 1 FROM models WHERE id = (SELECT model_id FROM params))::boolean as model_exists
),
resolve_profile_id AS (
    SELECT 
        CASE 
            WHEN (SELECT profile_id FROM params)::text IS NULL OR (SELECT profile_id FROM params)::text = '' THEN NULL::uuid
            ELSE (SELECT profile_id FROM params)::uuid
        END as resolved_profile_id
),
actor_profile AS (
    SELECT 
        (SELECT profile_id FROM params)::uuid as profile_id,
        COALESCE(COALESCE((SELECT n.name FROM profile_names pn JOIN names n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), ''), 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
model_data AS (
    SELECT 
        (SELECT n.name FROM model_names mn JOIN names n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        (SELECT d.description FROM model_descriptions md JOIN descriptions d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1),
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags fl ON mf.flag_id = fl.id WHERE mf.model_id = m.id AND fl.name = 'active' AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active,
        m.value,
        p.value as provider,
        p.id as provider_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1) as provider_name
    FROM models m
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers p ON p.id = mp.provider_id
    WHERE m.id = (SELECT model_id FROM params)
),
-- Determine if model is an image model (has 'image' output modality)
image_model_check AS (
    SELECT 
        CASE WHEN COUNT(*) > 0 THEN true ELSE false END as image_model
    FROM model_modalities
    WHERE model_id = (SELECT model_id FROM params) AND modality = 'image' AND is_input = false AND active = true
),
model_endpoint_data AS (
    SELECT 
        COALESCE(me.base_url, '') as base_url
    FROM models m
    LEFT JOIN model_endpoints me ON me.model_id = m.id AND me.active = true
    WHERE m.id = (SELECT model_id FROM params)
    LIMIT 1
),
model_departments_data AS (
    SELECT 
        md.model_id,
        ARRAY_AGG(md.department_id ORDER BY md.created_at) as department_ids
    FROM model_departments md
    WHERE md.model_id = (SELECT model_id FROM params) AND md.active = true
    GROUP BY md.model_id
),
model_departments_fallback AS (
    SELECT ARRAY[]::uuid[] as department_ids
    WHERE NOT EXISTS (SELECT 1 FROM model_departments_data WHERE model_id = (SELECT model_id FROM params))
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
    WHERE pd.active = true
),
user_departments_data AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d.description FROM document_descriptions dd JOIN descriptions d ON dd.description_id = d.id WHERE dd.document_id = d.id LIMIT 1)
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE EXISTS (SELECT 1 FROM document_flags df JOIN flags fl ON df.flag_id = fl.id WHERE df.document_id = d.id AND fl.name = 'active' AND df.type = 'active'::type_document_flags AND df.value = true)
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
providers_data AS (
    SELECT 
        p.id as provider_id,
        (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1),
        COALESCE((SELECT d.description FROM persona_descriptions pd JOIN descriptions d ON pd.description_id = d.id WHERE pd.persona_id = p.id LIMIT 1), '') as description
    FROM providers p
    WHERE EXISTS (SELECT 1 FROM persona_flags pf JOIN flags fl ON pf.flag_id = fl.id WHERE pf.persona_id = p.id AND fl.name = 'active' AND pf.type = 'active'::type_persona_flags AND pf.value = true)
    ORDER BY (SELECT n.name FROM persona_names pn JOIN names n ON pn.name_id = n.id WHERE pn.persona_id = p.id LIMIT 1)
),
model_all_keys AS (
    -- Get keys via settings system: settings -> provider -> key
    -- For each department that has this model, get keys from their settings
    SELECT DISTINCT
        spk.key_id,
        (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1) as name,
        k.key,
        COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = k.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) as active,
        ARRAY_AGG(DISTINCT ds.department_id) FILTER (WHERE ds.department_id IS NOT NULL) as department_ids
    FROM models m
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers p ON p.id = mp.provider_id
    JOIN setting_provider_keys spk ON spk.provider_id = p.id AND spk.active = true
    JOIN keys k ON k.id = spk.key_id AND EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    JOIN settings s ON s.id = spk.settings_id AND EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.scenario_id = s.id AND fl.name = 'active' AND sf.type = 'active'::type_scenario_flags AND sf.value = true)
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND ds.active = true
    GROUP BY spk.key_id, (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1), k.key, COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = k.id LIMIT 1), ''), EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE)
    
    UNION ALL
    
    -- General keys (keys without department links that user has access to)
    SELECT DISTINCT
        k.id as key_id,
        (SELECT n.name FROM key_names kn JOIN names n ON kn.name_id = n.id WHERE kn.key_id = k.id LIMIT 1) as name,
        k.key,
        COALESCE((SELECT d.description FROM key_descriptions kd JOIN descriptions d ON kd.description_id = d.id WHERE kd.key_id = k.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE),
        NULL::uuid[] as department_ids
    FROM keys k
    CROSS JOIN resolve_profile_id rpi
    WHERE EXISTS (SELECT 1 FROM key_flags kf JOIN flags fl ON kf.flag_id = fl.id WHERE kf.key_id = k.id AND fl.name = 'active' AND kf.type = 'active'::type_key_flags AND kf.value = TRUE) = true
    AND NOT EXISTS (
        -- Exclude keys already included via setting_provider_keys for this model's provider
        SELECT 1 FROM models m2
        JOIN model_providers mp2 ON mp2.model_id = m2.id
        JOIN providers p2 ON p2.id = mp2.provider_id
        JOIN setting_provider_keys spk2 ON spk2.provider_id = p2.id AND spk2.key_id = k.id AND spk2.active = true
        WHERE m2.id = (SELECT model_id FROM params)
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
            JOIN settings s4 ON s4.id = spk4.settings_id AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags fl ON sf.flag_id = fl.id WHERE sf.setting_id = s4.id AND fl.name = 'active' AND sf.type = 'active'::type_setting_flags AND sf.value = TRUE)
            JOIN department_settings ds4 ON ds4.settings_id = s4.id AND ds4.active = true
            JOIN user_departments ud ON ud.department_id = ds4.department_id
            WHERE spk4.key_id = k.id AND spk4.active = true
        )
        OR
        -- Superadmin can see all keys
        EXISTS (SELECT 1 FROM resolve_profile_id rpi2 JOIN profiles p ON p.id = rpi2.resolved_profile_id WHERE rpi2.resolved_profile_id = rpi.resolved_profile_id AND p.role = 'superadmin'::profile_role)
    )
),
keys_data AS (
    SELECT DISTINCT ON (mak.key_id) 
        mak.key_id,
        mak.name,
        mak.key,
        mak.description,
        mak.active,
        COALESCE(mak.department_ids, ARRAY[]::uuid[]) as department_ids
    FROM model_all_keys mak
    ORDER BY mak.key_id, mak.name
),
model_temperature_data AS (
    SELECT 
        model_id,
        MIN(temperature) FILTER (WHERE is_upper = false) as temperature_lower,
        MAX(temperature) FILTER (WHERE is_upper = true) as temperature_upper,
        ARRAY_AGG(DISTINCT temperature::text ORDER BY temperature::text) FILTER (WHERE is_upper = false) as temperature_values
    FROM model_temperature_levels
    WHERE model_id = (SELECT model_id FROM params) AND active = true
    GROUP BY model_id
),
model_pricing_data AS (
    SELECT 
        mp.pricing_type::text as pricing_type,
        u.id as unit_id,
        u.name as unit_name,
        u.unit_category::text as unit_category,
        mp.price
    FROM model_pricing mp
    JOIN units u ON u.id = mp.unit_id
    WHERE mp.model_id = (SELECT model_id FROM params) AND mp.active = true AND u.active = true
    ORDER BY mp.pricing_type, u.name
),
model_modalities_data AS (
    SELECT 
        ARRAY_AGG(modality::text ORDER BY modality::text) FILTER (WHERE is_input = true) as input_modalities,
        ARRAY_AGG(modality::text ORDER BY modality::text) FILTER (WHERE is_input = false) as output_modalities
    FROM model_modalities
    WHERE model_id = (SELECT model_id FROM params) AND active = true
),
model_reasoning_levels_data AS (
    SELECT 
        ARRAY_AGG(reasoning_level::text ORDER BY 
            CASE reasoning_level
                WHEN 'none' THEN 1
                WHEN 'minimal' THEN 2
                WHEN 'low' THEN 3
                WHEN 'medium' THEN 4
                WHEN 'high' THEN 5
            END
        ) as reasoning_levels
    FROM model_reasoning_levels
    WHERE model_id = (SELECT model_id FROM params) AND active = true
),
model_qualities_data AS (
    SELECT 
        ARRAY_AGG(quality::text ORDER BY 
            CASE quality
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
            END
        ) as qualities
    FROM model_qualities
    WHERE model_id = (SELECT model_id FROM params) AND active = true
),
model_voices_data AS (
    SELECT 
        id as voice_id,
        voice::text as voice
    FROM model_voices
    WHERE model_id = (SELECT model_id FROM params) AND active = true
    ORDER BY voice::text
),
all_units_data AS (
    SELECT 
        id as unit_id,
        name,
        unit_category::text as unit_category,
        value
    FROM units
    WHERE active = true
    ORDER BY unit_category, value, name
),
providers_aggregated AS (
    SELECT 
        ARRAY_AGG(pd.provider_id ORDER BY pd.provider_id) as valid_provider_ids,
        ARRAY_AGG((pd.provider_id, pd.name, pd.description)::types.q_get_model_detail_v4_provider ORDER BY pd.name) as providers
    FROM providers_data pd
),
departments_aggregated AS (
    SELECT 
        ARRAY_AGG(udd.id ORDER BY udd.id) as valid_department_ids,
        ARRAY_AGG((udd.id, udd.name, COALESCE(udd.description, ''))::types.q_get_model_detail_v4_department ORDER BY udd.name) as departments
    FROM user_departments_data udd
),
keys_aggregated AS (
    SELECT 
        ARRAY_AGG(kd.key_id ORDER BY kd.key_id) as valid_key_ids,
        ARRAY_AGG(
            (kd.key_id, kd.name, COALESCE(kd.description, ''), 
             CASE 
                 WHEN LENGTH(kd.key) > 4 THEN LEFT(kd.key, 4) || '****'
                 ELSE '****'
             END,
             kd.active,
             kd.department_ids
            )::types.q_get_model_detail_v4_key
            ORDER BY kd.name
        ) as keys
    FROM keys_data kd
),
pricing_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (mpd.pricing_type, mpd.unit_id, mpd.unit_name, mpd.unit_category, mpd.price)::types.q_get_model_detail_v4_pricing
            ORDER BY mpd.pricing_type, mpd.unit_name
        ) as pricing
    FROM model_pricing_data mpd
),
voices_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (mv.voice_id, mv.voice)::types.q_get_model_detail_v4_voice
            ORDER BY mv.voice
        ) as voices
    FROM model_voices_data mv
),
units_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (aud.unit_id, aud.name, aud.unit_category, aud.value)::types.q_get_model_detail_v4_unit
            ORDER BY aud.unit_category, aud.value, aud.name
        ) as units
    FROM all_units_data aud
)
SELECT 
    mec.model_exists::boolean as model_exists,
    -- Merge draft payload over existing model data if draft_id provided
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        md.name
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        md.description
    ) as description,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        md.active
    ) as active,
    COALESCE(imc.image_model, false) as image_model,
    md.provider,
    COALESCE(
        (SELECT (payload->>'provider_id')::uuid FROM draft_payload_data),
        md.provider_id
    ) as provider_id,
    md.provider_name,
    COALESCE(
        (SELECT payload->>'value' FROM draft_payload_data),
        md.value
    ) as value,
    COALESCE(
        (SELECT payload->>'base_url' FROM draft_payload_data),
        COALESCE(med.base_url, '')
    ) as base_url,
    COALESCE(pa.valid_provider_ids, ARRAY[]::uuid[]) as valid_provider_ids,
    COALESCE(pa.providers, '{}'::types.q_get_model_detail_v4_provider[]) as providers,
    COALESCE(da.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(da.departments, '{}'::types.q_get_model_detail_v4_department[]) as departments,
    -- Merge draft payload department_ids over existing model department_ids if draft_id provided
    COALESCE(
        CASE 
            WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))::uuid[]
            ELSE NULL
        END,
        COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::uuid[])
    ) as department_ids,
    COALESCE(ka.valid_key_ids, ARRAY[]::uuid[]) as valid_key_ids,
    COALESCE(ka.keys, '{}'::types.q_get_model_detail_v4_key[]) as keys,
    NULL::uuid as default_key_id,
    -- Merge draft payload temperature_bounds over existing model temperature if draft_id provided
    COALESCE(
        (SELECT (payload->'temperature_bounds'->>'lower')::float FROM draft_payload_data),
        COALESCE(mtd.temperature_lower, 0.0)
    ) as temperature_lower,
    COALESCE(
        (SELECT (payload->'temperature_bounds'->>'upper')::float FROM draft_payload_data),
        COALESCE(mtd.temperature_upper, 1.0)
    ) as temperature_upper,
    COALESCE(mtd.temperature_values, ARRAY[]::text[]) as temperature_values,
    -- Merge draft payload pricing over existing model pricing if draft_id provided
    COALESCE(
        (SELECT 
            ARRAY_AGG(
                (pricing_entry->>'type', 
                 (pricing_entry->>'unit_id')::uuid,
                 u.name,
                 u.unit_category::text,
                 (pricing_entry->>'price')::float
                )::types.q_get_model_detail_v4_pricing
            )
            FROM jsonb_array_elements((SELECT payload->'pricing' FROM draft_payload_data)) AS pricing_entry
            JOIN units u ON u.id = (pricing_entry->>'unit_id')::uuid AND u.active = true
        ),
        COALESCE(pra.pricing, '{}'::types.q_get_model_detail_v4_pricing[])
    ) as pricing,
    -- Merge draft payload modalities over existing model modalities if draft_id provided
    COALESCE(
        (SELECT 
            (
                ARRAY(SELECT jsonb_array_elements_text(payload->'modalities'->'input')),
                ARRAY(SELECT jsonb_array_elements_text(payload->'modalities'->'output'))
            )::types.q_get_model_detail_v4_modalities
            FROM draft_payload_data
        ),
        COALESCE(
            (COALESCE(mmod.input_modalities, ARRAY[]::text[]), COALESCE(mmod.output_modalities, ARRAY[]::text[]))::types.q_get_model_detail_v4_modalities,
            (ARRAY[]::text[], ARRAY[]::text[])::types.q_get_model_detail_v4_modalities
        )
    ) as modalities,
    -- Merge draft payload reasoning_levels over existing model reasoning_levels if draft_id provided
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'reasoning_levels')) FROM draft_payload_data),
        COALESCE(mrl.reasoning_levels, ARRAY[]::text[])
    ) as reasoning_levels,
    -- Merge draft payload voices over existing model voices if draft_id provided
    COALESCE(
        (SELECT 
            ARRAY_AGG(
                (gen_random_uuid(), voice_text)::types.q_get_model_detail_v4_voice
            )
            FROM jsonb_array_elements_text((SELECT payload->'voices' FROM draft_payload_data)) AS voice_text
        ),
        COALESCE(va.voices, '{}'::types.q_get_model_detail_v4_voice[])
    ) as voices,
    -- Merge draft payload qualities over existing model qualities if draft_id provided
    COALESCE(
        (SELECT ARRAY(SELECT jsonb_array_elements_text(payload->'qualities')) FROM draft_payload_data),
        COALESCE(mq.qualities, ARRAY[]::text[])
    ) as qualities,
    COALESCE(ua.units, '{}'::types.q_get_model_detail_v4_unit[]) as units,
    ap.actor_name::text as actor_name,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0) as draft_version
FROM model_exists_check mec
CROSS JOIN model_data md
CROSS JOIN actor_profile ap
CROSS JOIN providers_aggregated pa
CROSS JOIN departments_aggregated da
CROSS JOIN keys_aggregated ka
CROSS JOIN pricing_aggregated pra
CROSS JOIN voices_aggregated va
CROSS JOIN units_aggregated ua
LEFT JOIN image_model_check imc ON true
LEFT JOIN model_endpoint_data med ON true
LEFT JOIN model_departments_data mdd ON true
LEFT JOIN model_departments_fallback mdf ON true
LEFT JOIN model_temperature_data mtd ON true
LEFT JOIN model_modalities_data mmod ON true
LEFT JOIN model_reasoning_levels_data mrl ON true
LEFT JOIN model_qualities_data mq ON true
$$;