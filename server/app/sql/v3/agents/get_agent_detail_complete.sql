-- Get agent detail with prompts, departments, and access control
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
        WHERE proname = 'api_get_agent_detail_v3'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_detail_v3(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_agent_detail_v3_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_agent_detail_v3_department AS (
    department_id text,
    name text,
    description text
);

CREATE TYPE types.q_get_agent_detail_v3_prompt AS (
    prompt_id text,
    system_prompt text,
    name text,
    description text,
    created_at text,
    updated_at text,
    department_ids text[],
    can_delete boolean
);

CREATE TYPE types.q_get_agent_detail_v3_department_prompt_link AS (
    department_id text,
    prompt_id text
);

CREATE TYPE types.q_get_agent_detail_v3_debug_info AS (
    created_at text,
    model_id text,
    content text
);

CREATE TYPE types.q_get_agent_detail_v3_model AS (
    model_id text,
    name text,
    description text,
    input_modalities text[],
    output_modalities text[],
    temperature_lower float,
    temperature_upper float,
    temperature_levels jsonb,
    reasoning_options jsonb,
    available_voices jsonb
);

CREATE TYPE types.q_get_agent_detail_v3_reasoning_option AS (
    id text,
    reasoning_level text
);

CREATE TYPE types.q_get_agent_detail_v3_temperature_level AS (
    id text,
    temperature text,
    is_upper boolean
);

CREATE TYPE types.q_get_agent_detail_v3_available_voice AS (
    id text,
    voice text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_detail_v3(
    agent_id uuid,
    profile_id uuid
)
RETURNS TABLE (
    agent_exists boolean,
    agent_id text,
    name text,
    description text,
    system_prompt text,
    prompt_id text,
    model_id text,
    active boolean,
    role text,
    selected_temperature_level_id text,
    temperature float,
    selected_reasoning_level_id text,
    reasoning text,
    selected_voice_ids text[],
    valid_voices text[],
    department_ids text[],
    valid_department_ids text[],
    can_edit boolean,
    temperature_lower float,
    temperature_upper float,
    valid_model_ids text[],
    actor_name text,
    departments types.q_get_agent_detail_v3_department[],
    prompts types.q_get_agent_detail_v3_prompt[],
    department_prompt_links types.q_get_agent_detail_v3_department_prompt_link[],
    debug_info types.q_get_agent_detail_v3_debug_info[],
    models types.q_get_agent_detail_v3_model[],
    reasoning_options types.q_get_agent_detail_v3_reasoning_option[],
    temperature_levels types.q_get_agent_detail_v3_temperature_level[],
    available_voices types.q_get_agent_detail_v3_available_voice[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT agent_id AS agent_id,
           profile_id AS profile_id
),
agent_exists_check AS (
    -- Check if agent exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM agents WHERE id = (SELECT agent_id FROM params)
    )::boolean as agent_exists
),
agent_info AS (
    SELECT 
        id::text as agent_id,
        name,
        description,
        model_id::text,
        active,
        role::text
    FROM params x
    JOIN agents ON agents.id = x.agent_id
),
agent_active_prompt AS (
    SELECT 
        ap.agent_id::text as agent_id,
        ap.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id AND ap.active = true
    JOIN prompts pr ON pr.id = ap.prompt_id
    LIMIT 1
),
agent_all_prompts AS (
    -- Get all prompts from agent_prompts (default prompts)
    SELECT 
        ap.agent_id::text as agent_id,
        ap.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.name as prompt_name,
        pr.description as prompt_description,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id
    JOIN prompts pr ON pr.id = ap.prompt_id
    UNION
    -- Also get all prompts from agent_department_prompts (department-specific prompts)
    SELECT DISTINCT
        adp.agent_id::text as agent_id,
        adp.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.name as prompt_name,
        pr.description as prompt_description,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM params x
    JOIN agent_department_prompts adp ON adp.agent_id = x.agent_id AND adp.active = true
    JOIN prompts pr ON pr.id = adp.prompt_id
),
prompt_departments_data AS (
    SELECT 
        adp.prompt_id::text as prompt_id,
        ARRAY_AGG(adp.department_id::text ORDER BY adp.created_at) as department_ids
    FROM params x
    JOIN agent_department_prompts adp ON adp.agent_id = x.agent_id AND adp.active = true
    GROUP BY adp.prompt_id
),
default_prompt_count AS (
    -- Count default prompts (from agent_prompts, not department-specific)
    -- Always return at least one row with count (0 if no prompts)
    SELECT COALESCE(COUNT(DISTINCT ap.prompt_id), 0)::integer as count
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id
),
prompt_mapping_data AS (
    SELECT 
        ap.prompt_id::text as prompt_id,
        ap.system_prompt::text as system_prompt,
        COALESCE(ap.prompt_name, '')::text as prompt_name,
        COALESCE(ap.prompt_description, '')::text as prompt_description,
        ap.prompt_created_at::timestamptz as prompt_created_at,
        ap.prompt_updated_at::timestamptz as prompt_updated_at,
        COALESCE(pdd.department_ids, NULL)::text[] as department_ids,
        CASE
            -- Department-specific prompts can always be deleted (fall back to default)
            WHEN pdd.department_ids IS NOT NULL THEN true::boolean
            -- Default prompts can be deleted if there's more than one
            WHEN pdd.department_ids IS NULL AND COALESCE(dpc.count, 0) > 1 THEN true::boolean
            -- Otherwise cannot delete (only one default prompt)
            ELSE false::boolean
        END as can_delete
    FROM agent_all_prompts ap
    LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = ap.prompt_id
    CROSS JOIN default_prompt_count dpc
),
agent_departments_data AS (
    SELECT 
        ad.agent_id::text as agent_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM params x
    JOIN agent_departments ad ON ad.agent_id = x.agent_id AND ad.active = true
    GROUP BY ad.agent_id
),
agent_department_prompt_links_data AS (
    SELECT 
        adp.department_id::text as department_id,
        adp.prompt_id::text as prompt_id
    FROM params x
    JOIN agent_department_prompts adp ON adp.agent_id = x.agent_id AND adp.active = true
),
debug_data AS (
    SELECT 
        di.created_at,
        mrm.model_id::text,
        di.content
    FROM params x
    JOIN runs mr ON mr.agent_id = x.agent_id
    JOIN debug_info di ON di.run_id = mr.id
    JOIN run_models mrm ON mrm.run_id = mr.id
    WHERE mrm.active = true
    ORDER BY di.created_at DESC
    LIMIT 100
),
all_models AS (
    SELECT 
        id::text as model_id,
        name,
        COALESCE(description, '') as description,
        active
    FROM models
),
model_modalities_data AS (
    SELECT 
        mm.model_id::text as model_id,
        mm.modality::text as modality,
        mm.is_input::boolean as is_input
    FROM model_modalities mm
    WHERE mm.active = true
),
user_profile AS (
    SELECT 
        role,
        COALESCE(first_name || ' ' || last_name, 'System') as actor_name
    FROM params x
    JOIN profiles p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM params x
    JOIN departments d ON d.active = true
    JOIN profile_departments pd ON pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true
),
user_has_agent_access AS (
    -- Check if user has access to agent via department links
    SELECT EXISTS(
        SELECT 1 FROM params x
        JOIN agent_departments ad ON ad.agent_id = x.agent_id AND ad.active = true
        JOIN user_departments ud ON ud.id = ad.department_id::uuid
    ) OR EXISTS(
        SELECT 1 FROM params x
        JOIN profiles p ON p.id = x.profile_id AND p.role = 'superadmin'::profile_role
    ) OR (
        -- Default agents (no department links) are accessible to all
        SELECT COUNT(*) FROM params x
        JOIN agent_departments ad ON ad.agent_id = x.agent_id AND ad.active = true
    ) = 0 as has_access
),
valid_departments_data AS (
    SELECT 
        ud.id::text as department_id,
        ud.name::text as department_name,
        COALESCE(ud.description, '')::text as department_description
    FROM user_departments ud
),
valid_department_ids_list AS (
    SELECT array_agg(id::text ORDER BY name) as dept_ids
    FROM user_departments
),
agent_selected_voices AS (
    SELECT 
        av.agent_id::text as agent_id,
        mv.id::text as voice_id,
        mv.voice::text as voice
    FROM agent_voices av
    JOIN model_voices mv ON mv.id = av.model_voice_id
    WHERE av.active = true AND mv.active = true
),
agent_selected_temperature AS (
    SELECT 
        atl.agent_id::text as agent_id,
        atl.model_temperature_level_id::text as selected_temperature_level_id,
        mtl.temperature as selected_temperature
    FROM agent_temperature_levels atl
    JOIN model_temperature_levels mtl ON mtl.id = atl.model_temperature_level_id
    WHERE atl.active = true AND mtl.active = true
),
agent_selected_reasoning AS (
    SELECT 
        arl.agent_id::text as agent_id,
        arl.model_reasoning_level_id::text as selected_reasoning_level_id,
        mrl.reasoning_level::text as selected_reasoning
    FROM agent_reasoning_levels arl
    JOIN model_reasoning_levels mrl ON mrl.id = arl.model_reasoning_level_id
    WHERE arl.active = true AND mrl.active = true
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
model_voices_data_flat AS (
    SELECT 
        mv.model_id::text as model_id,
        mv.id::text as voice_id,
        mv.voice::text as voice_value
    FROM model_voices mv
    WHERE mv.active = true
),
models_agg AS (
    SELECT 
        am.model_id,
        am.name,
        am.description,
        COALESCE((SELECT array_agg(modality::text ORDER BY modality) FROM model_modalities_data WHERE model_id = am.model_id AND is_input = true), ARRAY[]::text[]) as input_modalities,
        COALESCE((SELECT array_agg(modality::text ORDER BY modality) FROM model_modalities_data WHERE model_id = am.model_id AND is_input = false), ARRAY[]::text[]) as output_modalities,
        COALESCE(mtb.temperature_lower, 0.0) as temperature_lower,
        COALESCE(mtb.temperature_upper, 1.0) as temperature_upper,
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
                mvf.voice_id,
                jsonb_build_object('voice', mvf.voice_value)
            ) FILTER (WHERE mvf.voice_id IS NOT NULL),
            '{}'::jsonb
        ) as available_voices
    FROM all_models am
    LEFT JOIN model_temperature_levels_bounds mtb ON mtb.model_id = am.model_id
    LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = am.model_id
    LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = am.model_id
    LEFT JOIN model_voices_data_flat mvf ON mvf.model_id = am.model_id
    GROUP BY am.model_id, am.name, am.description, mtb.temperature_lower, mtb.temperature_upper
)
SELECT 
    -- Agent existence check (always returned)
    aec.agent_exists::boolean as agent_exists,
    -- Top-level agent fields
    ai.agent_id::text as agent_id,
    ai.name::text as name,
    ai.description::text as description,
    COALESCE(aap.system_prompt, '')::text as system_prompt,
    COALESCE(aap.prompt_id, NULL)::text as prompt_id,
    ai.model_id::text as model_id,
    ai.active::boolean as active,
    ai.role::text as role,
    -- Selected options from junction tables
    COALESCE(ast.selected_temperature_level_id, '')::text as selected_temperature_level_id,
    COALESCE(ast.selected_temperature, 0.7)::float as temperature,
    COALESCE(asr.selected_reasoning_level_id, '')::text as selected_reasoning_level_id,
    COALESCE(asr.selected_reasoning, '')::text as reasoning,
    COALESCE((SELECT array_agg(asv2.voice_id::text ORDER BY asv2.voice) FROM agent_selected_voices asv2 WHERE asv2.agent_id = ai.agent_id), ARRAY[]::text[])::text[] as selected_voice_ids,
    COALESCE((SELECT array_agg(asv3.voice::text ORDER BY asv3.voice) FROM agent_selected_voices asv3 WHERE asv3.agent_id = ai.agent_id), ARRAY[]::text[])::text[] as valid_voices,
    COALESCE(add.department_ids, ARRAY[]::text[])::text[] as department_ids,
    COALESCE((SELECT dept_ids FROM valid_department_ids_list LIMIT 1), ARRAY[]::text[])::text[] as valid_department_ids,
    CASE 
        -- Default agents (no department_ids) are read-only for non-superadmin
        WHEN (COALESCE(add.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND up.role != 'superadmin') THEN false::boolean
        WHEN up.role = 'superadmin'::profile_role THEN true::boolean
        WHEN up.role IN ('admin'::profile_role, 'instructional'::profile_role) AND uhaa.has_access THEN true::boolean
        ELSE false::boolean
    END as can_edit,
    -- Temperature bounds for selected model
    COALESCE((SELECT temperature_lower FROM model_temperature_levels_bounds WHERE model_id = ai.model_id), 0.0)::float as temperature_lower,
    COALESCE((SELECT temperature_upper FROM model_temperature_levels_bounds WHERE model_id = ai.model_id), 1.0)::float as temperature_upper,
    -- Valid model IDs
    COALESCE((SELECT array_agg(model_id::text ORDER BY name) FROM all_models WHERE active = true), ARRAY[]::text[])::text[] as valid_model_ids,
    -- Top-level actor name
    up.actor_name::text as actor_name,
    -- Aggregated arrays
    COALESCE(
        ARRAY_AGG(
            (vdd.department_id, vdd.department_name, vdd.department_description
            )::types.q_get_agent_detail_v3_department
            ORDER BY vdd.department_name
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v3_department[]
    ) as departments,
    COALESCE(
        ARRAY_AGG(
            (pmd.prompt_id, pmd.system_prompt, pmd.prompt_name, pmd.prompt_description,
             pmd.prompt_created_at::text, pmd.prompt_updated_at::text,
             COALESCE(pmd.department_ids, ARRAY[]::text[]), pmd.can_delete
            )::types.q_get_agent_detail_v3_prompt
            ORDER BY pmd.prompt_created_at
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v3_prompt[]
    ) as prompts,
    COALESCE(
        ARRAY_AGG(
            (adpl.department_id, adpl.prompt_id
            )::types.q_get_agent_detail_v3_department_prompt_link
            ORDER BY adpl.department_id, adpl.prompt_id
        ) FILTER (WHERE uhaa.has_access = true AND adpl.department_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v3_department_prompt_link[]
    ) as department_prompt_links,
    COALESCE(
        ARRAY_AGG(
            (dd.created_at::text, dd.model_id, dd.content
            )::types.q_get_agent_detail_v3_debug_info
            ORDER BY dd.created_at DESC
        ) FILTER (WHERE uhaa.has_access = true AND dd.created_at IS NOT NULL),
        '{}'::types.q_get_agent_detail_v3_debug_info[]
    ) as debug_info,
    COALESCE(
        ARRAY_AGG(
            (ma.model_id, ma.name, ma.description,
             ma.input_modalities, ma.output_modalities,
             ma.temperature_lower, ma.temperature_upper,
             ma.temperature_levels, ma.reasoning_options, ma.available_voices
            )::types.q_get_agent_detail_v3_model
            ORDER BY ma.name
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v3_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (mrl_selected.reasoning_level_id, mrl_selected.reasoning_level_value
            )::types.q_get_agent_detail_v3_reasoning_option
            ORDER BY mrl_selected.reasoning_level_value
        ) FILTER (WHERE uhaa.has_access = true AND mrl_selected.reasoning_level_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v3_reasoning_option[]
    ) as reasoning_options,
    COALESCE(
        ARRAY_AGG(
            (mtl_selected.temperature_level_id, mtl_selected.temperature_value, mtl_selected.is_upper
            )::types.q_get_agent_detail_v3_temperature_level
            ORDER BY mtl_selected.temperature_value::float
        ) FILTER (WHERE uhaa.has_access = true AND mtl_selected.temperature_level_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v3_temperature_level[]
    ) as temperature_levels,
    COALESCE(
        ARRAY_AGG(
            (mvf_selected.voice_id, mvf_selected.voice_value
            )::types.q_get_agent_detail_v3_available_voice
            ORDER BY mvf_selected.voice_value
        ) FILTER (WHERE uhaa.has_access = true AND mvf_selected.voice_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v3_available_voice[]
    ) as available_voices
FROM agent_exists_check aec
CROSS JOIN user_profile up
CROSS JOIN user_has_agent_access uhaa
LEFT JOIN agent_info ai ON ai.agent_id = (SELECT agent_id::text FROM params) AND uhaa.has_access = true
LEFT JOIN agent_active_prompt aap ON aap.agent_id = ai.agent_id AND uhaa.has_access = true
LEFT JOIN agent_departments_data add ON add.agent_id = ai.agent_id AND uhaa.has_access = true
LEFT JOIN agent_selected_temperature ast ON ast.agent_id = ai.agent_id AND uhaa.has_access = true
LEFT JOIN agent_selected_reasoning asr ON asr.agent_id = ai.agent_id AND uhaa.has_access = true
LEFT JOIN valid_departments_data vdd ON uhaa.has_access = true
LEFT JOIN prompt_mapping_data pmd ON uhaa.has_access = true
LEFT JOIN agent_department_prompt_links_data adpl ON uhaa.has_access = true
LEFT JOIN debug_data dd ON uhaa.has_access = true
LEFT JOIN models_agg ma ON uhaa.has_access = true
LEFT JOIN model_reasoning_levels_data_with_ids mrl_selected ON mrl_selected.model_id = ai.model_id AND uhaa.has_access = true
LEFT JOIN model_temperature_levels_data_with_ids mtl_selected ON mtl_selected.model_id = ai.model_id AND uhaa.has_access = true
LEFT JOIN model_voices_data_flat mvf_selected ON mvf_selected.model_id = ai.model_id AND uhaa.has_access = true
GROUP BY aec.agent_exists, ai.agent_id, ai.name, ai.description, aap.system_prompt, aap.prompt_id,
         ai.model_id, ai.active, ai.role, ast.selected_temperature_level_id, ast.selected_temperature,
         asr.selected_reasoning_level_id, asr.selected_reasoning, add.department_ids, up.actor_name,
         up.role, uhaa.has_access
LIMIT 1
$$;

COMMIT;
