-- Get default agent detail for creation
-- Parameters: $1 = profile_id (uuid)

WITH resolve_profile_id AS (
    -- Resolve profile ID from parameter
    SELECT 
        CASE 
            WHEN $1::text IS NULL OR $1::text = '' THEN NULL::uuid
            ELSE $1::uuid
        END as resolved_profile_id
),
user_profile AS (
    SELECT 
        role,
        p.first_name || ' ' || p.last_name as actor_name
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
user_departments_for_models AS (
    SELECT DISTINCT pd.department_id
    FROM resolve_profile_id rpi
    JOIN profile_departments pd ON pd.profile_id = rpi.resolved_profile_id
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
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments_for_models)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY m.name
),
model_modalities_data AS (
    SELECT 
        mm.model_id::text as model_id,
        mm.modality::text as modality,
        mm.is_input::boolean as is_input
    FROM model_modalities mm
    WHERE mm.active = true
),
model_temperature_levels_data_with_ids AS (
    SELECT 
        mtl.model_id::text as model_id,
        mtl.id::text as temperature_level_id,
        mtl.temperature::text as temperature_value,
        mtl.is_upper::boolean as is_upper
    FROM model_temperature_levels mtl
    WHERE mtl.active = true
),
model_temperature_levels_bounds AS (
    SELECT 
        mtl.model_id::text as model_id,
        MIN(mtl.temperature) FILTER (WHERE mtl.is_upper = false)::float as temperature_lower,
        MAX(mtl.temperature) FILTER (WHERE mtl.is_upper = true)::float as temperature_upper
    FROM model_temperature_levels mtl
    WHERE mtl.active = true
    GROUP BY mtl.model_id
),
model_reasoning_levels_data_with_ids AS (
    SELECT 
        mrl.model_id::text as model_id,
        mrl.id::text as reasoning_level_id,
        mrl.reasoning_level::text as reasoning_level_value
    FROM model_reasoning_levels mrl
    WHERE mrl.active = true
),
model_voices_data AS (
    SELECT 
        mv.model_id::text as model_id,
        mv.id::text as voice_id,
        mv.voice::text as voice_value
    FROM model_voices mv
    WHERE mv.active = true
),
all_models_with_modalities AS (
    SELECT DISTINCT
        vm.model_id,
        vm.name,
        vm.description,
        vm.active
    FROM valid_models vm
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN resolve_profile_id rpi ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE d.active = true
    AND pd.profile_id = rpi.resolved_profile_id
    AND pd.active = true
),
valid_departments_list AS (
    SELECT array_agg(ud.id::text ORDER BY ud.name) as dept_ids
    FROM user_departments ud
),
valid_departments_data AS (
    SELECT 
        ud.id::text as department_id,
        ud.name::text as department_name,
        COALESCE(ud.description, '')::text as department_description
    FROM user_departments ud
)
SELECT 
    amwm.model_id::text as "model_mapping__id",
    amwm.name::text as "model_mapping__name",
    amwm.description::text as "model_mapping__description",
    COALESCE(mtb.temperature_lower, 0.0)::float as "model_mapping__temperature_lower",
    COALESCE(mtb.temperature_upper, 1.0)::float as "model_mapping__temperature_upper",
    mmod.modality::text as "model_mapping__input_modalities",
    CASE WHEN mmod.is_input = true THEN mmod.modality::text ELSE NULL::text END as "model_mapping__input_modality",
    CASE WHEN mmod.is_input = false THEN mmod.modality::text ELSE NULL::text END as "model_mapping__output_modality",
    mtl.temperature_level_id::text as "model_mapping__temperature_levels__id",
    mtl.temperature_value::text as "model_mapping__temperature_levels__temperature",
    mtl.is_upper::boolean as "model_mapping__temperature_levels__is_upper",
    mrl.reasoning_level_id::text as "model_mapping__reasoning_options__id",
    mrl.reasoning_level_value::text as "model_mapping__reasoning_options__reasoning_level",
    mv.voice_id::text as "model_mapping__available_voices__id",
    mv.voice_value::text as "model_mapping__available_voices__voice",
    vdd.department_id::text as "department_mapping__id",
    vdd.department_name::text as "department_mapping__name",
    vdd.department_description::text as "department_mapping__description",
    (SELECT array_agg(amwm2.model_id::text ORDER BY amwm2.name) FROM all_models_with_modalities amwm2)::text[] as valid_model_ids,
    COALESCE((SELECT dept_ids FROM valid_departments_list LIMIT 1), ARRAY[]::text[])::text[] as valid_department_ids,
    up.role::text as user_role,
    up.actor_name::text as actor_name,
    pdi.department_id::text as primary_department_id
FROM (SELECT 1) dummy
CROSS JOIN all_models_with_modalities amwm
CROSS JOIN valid_departments_data vdd
CROSS JOIN user_profile up
LEFT JOIN primary_department_id pdi ON true
LEFT JOIN model_temperature_levels_bounds mtb ON mtb.model_id = amwm.model_id
LEFT JOIN model_modalities_data mmod ON mmod.model_id = amwm.model_id
LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = amwm.model_id
LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = amwm.model_id
LEFT JOIN model_voices_data mv ON mv.model_id = amwm.model_id

