-- Get agent detail with prompts, departments, and access control
-- @params
--   agent_id: uuid
--   profile_id: uuid
-- All parameters are cast exactly once in params CTE for reliable type introspection
WITH params AS (
    SELECT $1::uuid AS agent_id,
           $2::uuid AS profile_id
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
        JOIN profiles p ON p.id = x.profile_id AND p.role = 'superadmin'
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
model_reasoning_levels_data AS (
    SELECT 
        mrl.model_id::text as model_id,
        jsonb_agg(mrl.reasoning_level::text ORDER BY 
            CASE mrl.reasoning_level
                WHEN 'none' THEN 1
                WHEN 'minimal' THEN 2
                WHEN 'low' THEN 3
                WHEN 'medium' THEN 4
                WHEN 'high' THEN 5
            END
        ) as reasoning_levels
    FROM model_reasoning_levels mrl
    WHERE mrl.active = true
    GROUP BY mrl.model_id
),
model_temperature_levels_data AS (
    SELECT 
        mtl.model_id::text as model_id,
        MIN(mtl.temperature) FILTER (WHERE mtl.is_upper = false) as temperature_lower,
        MAX(mtl.temperature) FILTER (WHERE mtl.is_upper = true) as temperature_upper,
        jsonb_agg(DISTINCT mtl.temperature::text) as temperature_values
    FROM model_temperature_levels mtl
    WHERE mtl.active = true
    GROUP BY mtl.model_id
),
-- Agent selected options from junction tables
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
-- Available model options
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
)
SELECT 
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
        WHEN up.role = 'superadmin' THEN true::boolean
        WHEN up.role IN ('admin', 'instructional') AND uhaa.has_access THEN true::boolean
        ELSE false::boolean
    END as can_edit,
    -- Temperature bounds for selected model
    COALESCE((SELECT temperature_lower FROM model_temperature_levels_bounds WHERE model_id = ai.model_id), 0.0)::float as temperature_lower,
    COALESCE((SELECT temperature_upper FROM model_temperature_levels_bounds WHERE model_id = ai.model_id), 1.0)::float as temperature_upper,
    -- Valid model IDs
    COALESCE((SELECT array_agg(model_id::text ORDER BY name) FROM all_models WHERE active = true), ARRAY[]::text[])::text[] as valid_model_ids,
    -- Top-level actor name
    up.actor_name::text as actor_name,
    -- Department mapping with __ prefix
    vdd.department_id::text as "department_mapping__id",
    vdd.department_name::text as "department_mapping__name",
    vdd.department_description::text as "department_mapping__description",
    -- Prompt mapping with __ prefix
    pmd.prompt_id::text as "prompt_mapping__id",
    pmd.system_prompt::text as "prompt_mapping__system_prompt",
    pmd.prompt_name::text as "prompt_mapping__name",
    pmd.prompt_description::text as "prompt_mapping__description",
    pmd.prompt_created_at::timestamptz as "prompt_mapping__created_at",
    pmd.prompt_updated_at::timestamptz as "prompt_mapping__updated_at",
    pmd.department_ids::text[] as "prompt_mapping__department_ids",
    pmd.can_delete::boolean as "prompt_mapping__can_delete",
    -- Department prompt links with __ prefix
    adpl.department_id::text as "department_prompt_links__department_id",
    adpl.prompt_id::text as "department_prompt_links__prompt_id",
    -- Debug info with __ prefix
    dd.created_at::timestamptz as "debug_info__created_at",
    dd.model_id::text as "debug_info__model_id",
    dd.content::text as "debug_info__content",
    -- Model mapping with __ prefix
    am.model_id::text as "model_mapping__id",
    am.name::text as "model_mapping__name",
    am.description::text as "model_mapping__description",
    COALESCE((SELECT array_agg(modality::text ORDER BY modality) FROM model_modalities_data WHERE model_id = am.model_id AND is_input = true), ARRAY[]::text[])::text[] as "model_mapping__input_modalities",
    COALESCE((SELECT array_agg(modality::text ORDER BY modality) FROM model_modalities_data WHERE model_id = am.model_id AND is_input = false), ARRAY[]::text[])::text[] as "model_mapping__output_modalities",
    COALESCE(mtb.temperature_lower, 0.0)::float as "model_mapping__temperature_lower",
    COALESCE(mtb.temperature_upper, 1.0)::float as "model_mapping__temperature_upper",
    -- Model temperature levels with nested __ prefix
    mtl.temperature_level_id::text as "model_mapping__temperature_levels__id",
    mtl.temperature_value::text as "model_mapping__temperature_levels__temperature",
    mtl.is_upper::boolean as "model_mapping__temperature_levels__is_upper",
    -- Model reasoning options with nested __ prefix
    mrl.reasoning_level_id::text as "model_mapping__reasoning_options__id",
    mrl.reasoning_level_value::text as "model_mapping__reasoning_options__reasoning_level",
    -- Model available voices with nested __ prefix
    mvf.voice_id::text as "model_mapping__available_voices__id",
    mvf.voice_value::text as "model_mapping__available_voices__voice",
    -- Reasoning options for selected model with __ prefix
    mrl_selected.reasoning_level_id::text as "reasoning_options__id",
    mrl_selected.reasoning_level_value::text as "reasoning_options__reasoning_level",
    -- Temperature levels for selected model with __ prefix
    mtl_selected.temperature_level_id::text as "temperature_levels__id",
    mtl_selected.temperature_value::text as "temperature_levels__temperature",
    mtl_selected.is_upper::boolean as "temperature_levels__is_upper",
    -- Available voices for selected model with __ prefix
    mvf_selected.voice_id::text as "available_voices__id",
    mvf_selected.voice_value::text as "available_voices__voice"
FROM agent_info ai
LEFT JOIN agent_active_prompt aap ON aap.agent_id = ai.agent_id
LEFT JOIN agent_departments_data add ON add.agent_id = ai.agent_id
LEFT JOIN agent_selected_temperature ast ON ast.agent_id = ai.agent_id
LEFT JOIN agent_selected_reasoning asr ON asr.agent_id = ai.agent_id
CROSS JOIN valid_departments_data vdd
CROSS JOIN prompt_mapping_data pmd
LEFT JOIN agent_department_prompt_links_data adpl ON true
LEFT JOIN debug_data dd ON true
CROSS JOIN all_models am
LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = am.model_id
LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = am.model_id
LEFT JOIN model_voices_data_flat mvf ON mvf.model_id = am.model_id
LEFT JOIN model_temperature_levels_bounds mtb ON mtb.model_id = am.model_id
LEFT JOIN model_reasoning_levels_data_with_ids mrl_selected ON mrl_selected.model_id = ai.model_id
LEFT JOIN model_temperature_levels_data_with_ids mtl_selected ON mtl_selected.model_id = ai.model_id
LEFT JOIN model_voices_data_flat mvf_selected ON mvf_selected.model_id = ai.model_id
CROSS JOIN user_profile up
CROSS JOIN user_has_agent_access uhaa
WHERE uhaa.has_access = true

