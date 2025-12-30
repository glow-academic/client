-- Get model detail with department, key, and endpoint information
-- Converted to function with composite types
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

BEGIN;

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_model_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_model_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_model_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_model_detail_v3_provider AS (
    provider_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_detail_v3_department AS (
    department_id uuid,
    name text,
    description text
);

CREATE TYPE types.q_get_model_detail_v3_key AS (
    key_id uuid,
    name text,
    description text,
    key_masked text,
    active boolean,
    department_ids uuid[]
);

CREATE TYPE types.q_get_model_detail_v3_pricing AS (
    pricing_type text,
    unit_id uuid,
    unit_name text,
    unit_category text,
    price float
);

CREATE TYPE types.q_get_model_detail_v3_unit AS (
    unit_id uuid,
    name text,
    unit_category text,
    value int
);

CREATE TYPE types.q_get_model_detail_v3_modalities AS (
    input text[],
    output text[]
);

CREATE TYPE types.q_get_model_detail_v3_voice AS (
    voice_id uuid,
    voice text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_model_detail_v3(
    model_id uuid,
    profile_id uuid
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
    providers types.q_get_model_detail_v3_provider[],
    valid_department_ids uuid[],
    departments types.q_get_model_detail_v3_department[],
    department_ids uuid[],
    valid_key_ids uuid[],
    keys types.q_get_model_detail_v3_key[],
    default_key_id uuid,
    temperature_lower float,
    temperature_upper float,
    temperature_values text[],
    pricing types.q_get_model_detail_v3_pricing[],
    modalities types.q_get_model_detail_v3_modalities,
    reasoning_levels text[],
    voices types.q_get_model_detail_v3_voice[],
    qualities text[],
    units types.q_get_model_detail_v3_unit[],
    actor_name text
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT model_id AS model_id, profile_id AS profile_id
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
        COALESCE(p.first_name || ' ' || p.last_name, 'System') as actor_name
    FROM profiles p
    WHERE p.id = (SELECT profile_id FROM params)::uuid
),
model_data AS (
    SELECT 
        m.name,
        m.description,
        m.active,
        m.value,
        p.value as provider,
        p.id as provider_id,
        p.name as provider_name
    FROM models m
    JOIN providers p ON p.id = m.provider_id
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
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON d.id = pd.department_id
    WHERE d.active = true
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
providers_data AS (
    SELECT 
        p.id as provider_id,
        p.name,
        COALESCE(p.description, '') as description
    FROM providers p
    WHERE p.active = true
    ORDER BY p.name
),
model_all_keys AS (
    -- Get keys via settings system: settings -> provider -> key
    -- For each department that has this model, get keys from their settings
    SELECT DISTINCT
        spk.key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        ARRAY_AGG(DISTINCT ds.department_id) FILTER (WHERE ds.department_id IS NOT NULL) as department_ids
    FROM models m
    JOIN providers p ON p.id = m.provider_id
    JOIN setting_provider_keys spk ON spk.provider_id = p.id AND spk.active = true
    JOIN keys k ON k.id = spk.key_id AND k.active = true
    JOIN settings s ON s.id = spk.settings_id AND s.active = true
    JOIN department_settings ds ON ds.settings_id = s.id AND ds.active = true
    WHERE m.id = (SELECT model_id FROM params)
    AND ds.active = true
    GROUP BY spk.key_id, k.name, k.key, k.description, k.active
    
    UNION ALL
    
    -- General keys (keys without department links that user has access to)
    SELECT DISTINCT
        k.id as key_id,
        k.name,
        k.key,
        k.description,
        k.active,
        NULL::uuid[] as department_ids
    FROM keys k
    CROSS JOIN resolve_profile_id rpi
    WHERE k.active = true
    AND NOT EXISTS (
        -- Exclude keys already included via setting_provider_keys for this model's provider
        SELECT 1 FROM models m2
        JOIN providers p2 ON p2.id = m2.provider_id
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
            JOIN settings s4 ON s4.id = spk4.settings_id AND s4.active = true
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
        ARRAY_AGG((pd.provider_id, pd.name, pd.description)::types.q_get_model_detail_v3_provider ORDER BY pd.name) as providers
    FROM providers_data pd
),
departments_aggregated AS (
    SELECT 
        ARRAY_AGG(udd.id ORDER BY udd.id) as valid_department_ids,
        ARRAY_AGG((udd.id, udd.name, COALESCE(udd.description, ''))::types.q_get_model_detail_v3_department ORDER BY udd.name) as departments
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
            )::types.q_get_model_detail_v3_key
            ORDER BY kd.name
        ) as keys
    FROM keys_data kd
),
pricing_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (mpd.pricing_type, mpd.unit_id, mpd.unit_name, mpd.unit_category, mpd.price)::types.q_get_model_detail_v3_pricing
            ORDER BY mpd.pricing_type, mpd.unit_name
        ) as pricing
    FROM model_pricing_data mpd
),
voices_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (mv.voice_id, mv.voice)::types.q_get_model_detail_v3_voice
            ORDER BY mv.voice
        ) as voices
    FROM model_voices_data mv
),
units_aggregated AS (
    SELECT 
        ARRAY_AGG(
            (aud.unit_id, aud.name, aud.unit_category, aud.value)::types.q_get_model_detail_v3_unit
            ORDER BY aud.unit_category, aud.value, aud.name
        ) as units
    FROM all_units_data aud
)
SELECT 
    mec.model_exists::boolean as model_exists,
    md.name,
    md.description,
    md.active,
    COALESCE(imc.image_model, false) as image_model,
    md.provider,
    md.provider_id,
    md.provider_name,
    md.value,
    COALESCE(med.base_url, '') as base_url,
    COALESCE(pa.valid_provider_ids, ARRAY[]::uuid[]) as valid_provider_ids,
    COALESCE(pa.providers, '{}'::types.q_get_model_detail_v3_provider[]) as providers,
    COALESCE(da.valid_department_ids, ARRAY[]::uuid[]) as valid_department_ids,
    COALESCE(da.departments, '{}'::types.q_get_model_detail_v3_department[]) as departments,
    COALESCE(mdd.department_ids, mdf.department_ids, ARRAY[]::uuid[]) as department_ids,
    COALESCE(ka.valid_key_ids, ARRAY[]::uuid[]) as valid_key_ids,
    COALESCE(ka.keys, '{}'::types.q_get_model_detail_v3_key[]) as keys,
    NULL::uuid as default_key_id,
    COALESCE(mtd.temperature_lower, 0.0) as temperature_lower,
    COALESCE(mtd.temperature_upper, 1.0) as temperature_upper,
    COALESCE(mtd.temperature_values, ARRAY[]::text[]) as temperature_values,
    COALESCE(pra.pricing, '{}'::types.q_get_model_detail_v3_pricing[]) as pricing,
    COALESCE(
        (COALESCE(mmod.input_modalities, ARRAY[]::text[]), COALESCE(mmod.output_modalities, ARRAY[]::text[]))::types.q_get_model_detail_v3_modalities,
        (ARRAY[]::text[], ARRAY[]::text[])::types.q_get_model_detail_v3_modalities
    ) as modalities,
    COALESCE(mrl.reasoning_levels, ARRAY[]::text[]) as reasoning_levels,
    COALESCE(va.voices, '{}'::types.q_get_model_detail_v3_voice[]) as voices,
    COALESCE(mq.qualities, ARRAY[]::text[]) as qualities,
    COALESCE(ua.units, '{}'::types.q_get_model_detail_v3_unit[]) as units,
    ap.actor_name::text as actor_name
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

COMMIT;
