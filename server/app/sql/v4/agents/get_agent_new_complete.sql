-- Get default agent detail for creation
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
        WHERE proname = 'api_get_agent_new_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_new_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_agent_new_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_agent_new_v4_model AS (
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

CREATE TYPE types.q_get_agent_new_v4_department AS (
    department_id text,
    name text,
    description text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_new_v4(
    profile_id uuid,
    draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    actor_name text,
    user_role text,
    primary_department_id text,
    valid_model_ids text[],
    valid_department_ids text[],
    models types.q_get_agent_new_v4_model[],
    departments types.q_get_agent_new_v4_department[],
    name text,
    description text,
    system_prompt text,
    prompt_id text,
    model_id text,
    active boolean,
    role text,
    department_ids text[],
    temperature_level_id text,
    reasoning_level_id text,
    voice_ids text[],
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        profile_id AS profile_id,
        draft_id AS draft_id
),
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload,
        d.version as draft_version
    FROM params x
    JOIN drafts d ON d.id = x.draft_id
    WHERE x.draft_id IS NOT NULL
    AND d.profile_id = x.profile_id
    
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' || (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
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
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1),
        COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = m.id AND mf.type = 'active'::type_model_flags AND mf.value = TRUE)
    FROM model_artifact m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = m.id AND mf.type = 'active'::type_model_flags AND mf.value = true)
    GROUP BY m.id, (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), (SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = m.id AND mf.type = 'active'::type_model_flags AND mf.value = TRUE)
    HAVING 
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments_for_models)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1)
),
model_modalities_data AS (
    SELECT 
        mm.model_id::text as model_id,
        mr.modality::text as modality,
        CASE WHEN mm.type = 'input'::type_model_modalities THEN true ELSE false END as is_input
    FROM model_modalities mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.active = true AND mr.active = true
),
model_temperature_levels_data_with_ids AS (
    SELECT 
        mtl.model_id::text as model_id,
        tl.id::text as temperature_level_id,
        tl.temperature::text as temperature_value,
        tl.is_upper::boolean as is_upper
    FROM model_temperature_levels mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE tl.active = true
),
model_temperature_levels_bounds AS (
    SELECT 
        mtl.model_id::text as model_id,
        MIN(tl.temperature) FILTER (WHERE tl.is_upper = false)::float as temperature_lower,
        MAX(tl.temperature) FILTER (WHERE tl.is_upper = true)::float as temperature_upper
    FROM model_temperature_levels mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE tl.active = true
    GROUP BY mtl.model_id
),
model_reasoning_levels_data_with_ids AS (
    SELECT 
        mrl.model_id::text as model_id,
        rl.id::text as reasoning_level_id,
        rl.reasoning_level::text as reasoning_level_value
    FROM model_reasoning_levels mrl
    JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
    WHERE rl.active = true
),
model_voices_data AS (
    SELECT 
        mv.model_id::text as model_id,
        v.id::text as voice_id,
        v.voice::text as voice_value
    FROM model_voices mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE v.active = true
),
all_models_with_modalities AS (
    SELECT DISTINCT
        vm.model_id,
        vm.name,
        vm.description,
        EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = vm.model_id::uuid AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active
    FROM valid_models vm
),
user_departments AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1)
    FROM department_artifact d
    JOIN params x ON true
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
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
            )::types.q_get_agent_new_v4_model
            ORDER BY ma.name
        ),
        '{}'::types.q_get_agent_new_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (vdd.department_id, vdd.department_name, vdd.department_description
            )::types.q_get_agent_new_v4_department
            ORDER BY vdd.department_name
        ),
        '{}'::types.q_get_agent_new_v4_department[]
    ) as departments,
    -- Default values for new agent (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        'New Agent'::text
    ) as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ''::text
    ) as description,
    COALESCE(
        (SELECT payload->>'systemPrompt' FROM draft_payload_data),
        (SELECT payload->>'system_prompt' FROM draft_payload_data),
        ''::text
    ) as system_prompt,
    COALESCE(
        CASE 
            WHEN (SELECT payload->>'promptId' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'promptId' FROM draft_payload_data)
            WHEN (SELECT payload->>'prompt_id' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'prompt_id' FROM draft_payload_data)
            ELSE NULL
        END,
        NULL
    )::text as prompt_id,
    COALESCE(
        (SELECT payload->>'modelId' FROM draft_payload_data),
        (SELECT payload->>'model_id' FROM draft_payload_data),
        ''::text
    ) as model_id,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        true::boolean
    ) as active,
    COALESCE(
        (SELECT payload->>'role' FROM draft_payload_data),
        'assistant'::text
    ) as role,
    COALESCE(
        CASE 
            WHEN (SELECT payload->'departmentIds' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'departmentIds' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'departmentIds' FROM draft_payload_data)))::text[]
            WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))::text[]
            ELSE NULL
        END,
        ARRAY[]::text[]
    ) as department_ids,
    COALESCE(
        CASE 
            WHEN (SELECT payload->>'model_temperature_level_id' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'model_temperature_level_id' FROM draft_payload_data)
            ELSE NULL
        END,
        NULL
    )::text as temperature_level_id,
    COALESCE(
        CASE 
            WHEN (SELECT payload->>'model_reasoning_level_id' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'model_reasoning_level_id' FROM draft_payload_data)
            ELSE NULL
        END,
        NULL
    )::text as reasoning_level_id,
    COALESCE(
        CASE 
            WHEN (SELECT payload->'model_voice_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'model_voice_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'model_voice_ids' FROM draft_payload_data)))::text[]
            ELSE NULL
        END,
        ARRAY[]::text[]
    ) as voice_ids,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0)::int as draft_version
FROM user_profile up
CROSS JOIN models_agg ma
CROSS JOIN valid_departments_data vdd
LEFT JOIN primary_department_id pdi ON true
GROUP BY up.actor_name, up.role, pdi.department_id
$$;