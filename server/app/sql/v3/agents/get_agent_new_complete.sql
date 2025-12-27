-- Get default agent detail for creation
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
        WHERE proname = 'api_get_agent_new_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_new_v3(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE
-- Drop all types matching prefix pattern to handle type additions/removals
-- If any other object depends on them, this will ERROR and stop the migration (good)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT typname 
        FROM pg_type 
        WHERE typname LIKE 'q_get_agent_new_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_agent_new_v3_model AS (
    model_id text,
    name text,
    description text,
    active boolean,
    temperature_lower float,
    temperature_upper float,
    input_modalities text[],
    output_modalities text[],
    temperature_levels jsonb,
    reasoning_options jsonb,
    available_voices jsonb
);

CREATE TYPE types.q_get_agent_new_v3_department AS (
    department_id text,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_new_v3(profile_id uuid)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id text,
    valid_model_ids text[],
    valid_department_ids text[],
    models types.q_get_agent_new_v3_model[],
    departments types.q_get_agent_new_v3_department[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT profile_id AS profile_id
),
user_profile AS (
    SELECT 
        role,
        p.first_name || ' ' || p.last_name as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
primary_department_id AS (
    SELECT department_id::text
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
    WHERE pd.is_primary = TRUE
    LIMIT 1
),
user_departments_for_models AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id
),
valid_models AS (
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
    JOIN params x ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE d.active = true
    AND pd.profile_id = x.profile_id
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
),
models_agg AS (
    SELECT 
        amwm.model_id,
        amwm.name,
        amwm.description,
        amwm.active,
        COALESCE(mtb.temperature_lower, 0.0) as temperature_lower,
        COALESCE(mtb.temperature_upper, 1.0) as temperature_upper,
        COALESCE((SELECT array_agg(mmod2.modality::text ORDER BY mmod2.modality) FROM model_modalities_data mmod2 WHERE mmod2.model_id = amwm.model_id AND mmod2.is_input = true), ARRAY[]::text[]) as input_modalities,
        COALESCE((SELECT array_agg(mmod3.modality::text ORDER BY mmod3.modality) FROM model_modalities_data mmod3 WHERE mmod3.model_id = amwm.model_id AND mmod3.is_input = false), ARRAY[]::text[]) as output_modalities,
        COALESCE(
            jsonb_object_agg(
                mtl.temperature_level_id,
                jsonb_build_object('temperature', mtl.temperature_value, 'is_upper', mtl.is_upper)
            ) FILTER (WHERE mtl.temperature_level_id IS NOT NULL),
            '{}'::jsonb
        ) as temperature_levels,
        COALESCE(
            jsonb_object_agg(
                mrl.reasoning_level_id,
                jsonb_build_object('reasoning_level', mrl.reasoning_level_value)
            ) FILTER (WHERE mrl.reasoning_level_id IS NOT NULL),
            '{}'::jsonb
        ) as reasoning_options,
        COALESCE(
            jsonb_object_agg(
                mv.voice_id,
                jsonb_build_object('voice', mv.voice_value)
            ) FILTER (WHERE mv.voice_id IS NOT NULL),
            '{}'::jsonb
        ) as available_voices
    FROM all_models_with_modalities amwm
    LEFT JOIN model_temperature_levels_bounds mtb ON mtb.model_id = amwm.model_id
    LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = amwm.model_id
    LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = amwm.model_id
    LEFT JOIN model_voices_data mv ON mv.model_id = amwm.model_id
    GROUP BY amwm.model_id, amwm.name, amwm.description, amwm.active, mtb.temperature_lower, mtb.temperature_upper
)
SELECT 
    up.actor_name::text as actor_name,
    up.role::text as user_role,
    pdi.department_id::text as primary_department_id,
    (SELECT array_agg(amwm2.model_id::text ORDER BY amwm2.name) FROM all_models_with_modalities amwm2)::text[] as valid_model_ids,
    COALESCE((SELECT dept_ids FROM valid_departments_list LIMIT 1), ARRAY[]::text[])::text[] as valid_department_ids,
    COALESCE(
        ARRAY_AGG(
            (ma.model_id, ma.name, ma.description, ma.active,
             ma.temperature_lower, ma.temperature_upper,
             ma.input_modalities, ma.output_modalities,
             ma.temperature_levels, ma.reasoning_options, ma.available_voices
            )::types.q_get_agent_new_v3_model
            ORDER BY ma.name
        ),
        '{}'::types.q_get_agent_new_v3_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (vdd.department_id, vdd.department_name, vdd.department_description
            )::types.q_get_agent_new_v3_department
            ORDER BY vdd.department_name
        ),
        '{}'::types.q_get_agent_new_v3_department[]
    ) as departments
FROM user_profile up
CROSS JOIN models_agg ma
CROSS JOIN valid_departments_data vdd
LEFT JOIN primary_department_id pdi ON true
GROUP BY up.actor_name, up.role, pdi.department_id
$$;

COMMIT;
