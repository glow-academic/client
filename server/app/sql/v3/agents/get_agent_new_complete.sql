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
        jsonb_agg(mm.modality::text ORDER BY mm.modality::text) FILTER (WHERE mm.is_input = true) as input_modalities,
        jsonb_agg(mm.modality::text ORDER BY mm.modality::text) FILTER (WHERE mm.is_input = false) as output_modalities
    FROM model_modalities mm
    WHERE mm.active = true
    GROUP BY mm.model_id
),
model_temperature_levels_data_with_ids AS (
    SELECT 
        mtl.model_id::text as model_id,
        MIN(mtl.temperature) FILTER (WHERE mtl.is_upper = false) as temperature_lower,
        MAX(mtl.temperature) FILTER (WHERE mtl.is_upper = true) as temperature_upper,
        jsonb_agg(
            jsonb_build_object(
                'id', mtl.id::text,
                'temperature', mtl.temperature::text,
                'is_upper', mtl.is_upper
            ) ORDER BY mtl.temperature::text
        ) as temperature_levels
    FROM model_temperature_levels mtl
    WHERE mtl.active = true
    GROUP BY mtl.model_id
),
model_reasoning_levels_data_with_ids AS (
    SELECT 
        mrl.model_id::text as model_id,
        jsonb_agg(
            jsonb_build_object(
                'id', mrl.id::text,
                'reasoning_level', mrl.reasoning_level::text
            ) ORDER BY mrl.reasoning_level::text
        ) as reasoning_levels
    FROM model_reasoning_levels mrl
    WHERE mrl.active = true
    GROUP BY mrl.model_id
),
model_voices_data AS (
    SELECT 
        mv.model_id::text as model_id,
        jsonb_agg(
            jsonb_build_object(
                'id', mv.id::text,
                'voice', mv.voice::text
            ) ORDER BY mv.voice::text
        ) as voices
    FROM model_voices mv
    WHERE mv.active = true
    GROUP BY mv.model_id
),
all_models_with_modalities AS (
    SELECT 
        vm.model_id,
        vm.name,
        vm.description,
        vm.active,
        COALESCE(
            jsonb_build_object(
                'input', COALESCE(mmod.input_modalities, '[]'::jsonb),
                'output', COALESCE(mmod.output_modalities, '[]'::jsonb)
            ),
            jsonb_build_object('input', '[]'::jsonb, 'output', '[]'::jsonb)
        ) as modalities
    FROM valid_models vm
    LEFT JOIN model_modalities_data mmod ON mmod.model_id = vm.model_id
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
    FROM user_departments ud
)
SELECT 
    COALESCE(
        (SELECT jsonb_object_agg(
            amwm.model_id,
            jsonb_build_object(
                'name', amwm.name, 
                'description', amwm.description,
                'modalities', amwm.modalities,
                'input_modalities', COALESCE((amwm.modalities->>'input')::jsonb, '[]'::jsonb),
                'output_modalities', COALESCE((amwm.modalities->>'output')::jsonb, '[]'::jsonb),
                'temperature_lower', COALESCE(mtl.temperature_lower, 0.0),
                'temperature_upper', COALESCE(mtl.temperature_upper, 1.0),
                'temperature_levels', COALESCE(mtl.temperature_levels, '[]'::jsonb),
                'reasoning_options', COALESCE(mrl.reasoning_levels, '[]'::jsonb),
                'available_voices', COALESCE(mv.voices, '[]'::jsonb)
            )
        )
        FROM all_models_with_modalities amwm
        LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = amwm.model_id
        LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = amwm.model_id
        LEFT JOIN model_voices_data mv ON mv.model_id = amwm.model_id),
        '{}'::jsonb
    ) as model_mapping,
    COALESCE(
        (SELECT jsonb_agg(amwm.model_id ORDER BY amwm.name)
        FROM all_models_with_modalities amwm),
        '[]'::jsonb
    ) as valid_model_ids,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    up.role as user_role,
    up.actor_name,
    pdi.department_id as primary_department_id
FROM (SELECT 1) dummy
CROSS JOIN valid_departments_data vdd
CROSS JOIN user_profile up
LEFT JOIN primary_department_id pdi ON true

