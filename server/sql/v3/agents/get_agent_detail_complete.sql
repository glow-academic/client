-- Get agent detail with prompts, departments, and access control
-- Parameters: $1 = agent_id (uuid), $2 = profile_id (uuid)

WITH agent_info AS (
    SELECT 
        id::text as agent_id,
        name,
        description,
        model_id::text,
        active,
        role::text
    FROM agents
    WHERE id = $1::uuid
),
agent_active_prompt AS (
    SELECT 
        ap.agent_id::text as agent_id,
        ap.prompt_id::text as prompt_id,
        pr.system_prompt,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid AND ap.active = true
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
    FROM agent_prompts ap
    JOIN prompts pr ON pr.id = ap.prompt_id
    WHERE ap.agent_id = $1::uuid
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
    FROM agent_department_prompts adp
    JOIN prompts pr ON pr.id = adp.prompt_id
    WHERE adp.agent_id = $1::uuid AND adp.active = true
),
prompt_departments_data AS (
    SELECT 
        adp.prompt_id::text as prompt_id,
        ARRAY_AGG(adp.department_id::text ORDER BY adp.created_at) as department_ids
    FROM agent_department_prompts adp
    WHERE adp.agent_id = $1::uuid AND adp.active = true
    GROUP BY adp.prompt_id
),
default_prompt_count AS (
    -- Count default prompts (from agent_prompts, not department-specific)
    -- Always return at least one row with count (0 if no prompts)
    SELECT COALESCE(COUNT(DISTINCT ap.prompt_id), 0)::integer as count
    FROM agent_prompts ap
    WHERE ap.agent_id = $1::uuid
),
prompt_mapping_data AS (
    SELECT 
        COALESCE(
            jsonb_object_agg(
                ap.prompt_id,
                jsonb_build_object(
                    'system_prompt', ap.system_prompt,
                    'name', COALESCE(ap.prompt_name, ''),
                    'description', COALESCE(ap.prompt_description, ''),
                    'created_at', ap.prompt_created_at::text,
                    'updated_at', ap.prompt_updated_at::text,
                    'department_ids', COALESCE(pdd.department_ids, NULL),
                    'can_delete', CASE
                        -- Department-specific prompts can always be deleted (fall back to default)
                        WHEN pdd.department_ids IS NOT NULL THEN true::boolean
                        -- Default prompts can be deleted if there's more than one
                        WHEN pdd.department_ids IS NULL AND COALESCE(dpc.count, 0) > 1 THEN true::boolean
                        -- Otherwise cannot delete (only one default prompt)
                        ELSE false::boolean
                    END
                )
            ),
            '{}'::jsonb
        ) as prompt_mapping
    FROM agent_all_prompts ap
    LEFT JOIN prompt_departments_data pdd ON pdd.prompt_id = ap.prompt_id
    CROSS JOIN default_prompt_count dpc
),
agent_departments_data AS (
    SELECT 
        ad.agent_id::text as agent_id,
        ARRAY_AGG(ad.department_id::text ORDER BY ad.created_at) as department_ids
    FROM agent_departments ad
    WHERE ad.agent_id = $1::uuid AND ad.active = true
    GROUP BY ad.agent_id
),
agent_department_prompt_links AS (
    SELECT 
        COALESCE(
            (SELECT jsonb_object_agg(
                adp.department_id::text,
                adp.prompt_id::text
            )
            FROM agent_department_prompts adp
            WHERE adp.agent_id = $1::uuid AND adp.active = true),
            '{}'::jsonb
        ) as department_prompt_links
),
debug_data AS (
    SELECT 
        di.created_at,
        mrm.model_id::text,
        di.content
    FROM runs mr
    JOIN debug_info di ON di.run_id = mr.id
    JOIN run_models mrm ON mrm.run_id = mr.id
    WHERE mr.agent_id = $1::uuid
    AND mrm.active = true
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
        jsonb_agg(mm.modality::text ORDER BY mm.modality::text) FILTER (WHERE mm.is_input = true) as input_modalities,
        jsonb_agg(mm.modality::text ORDER BY mm.modality::text) FILTER (WHERE mm.is_input = false) as output_modalities
    FROM model_modalities mm
    WHERE mm.active = true
    GROUP BY mm.model_id
),
all_models_with_modalities AS (
    SELECT 
        am.model_id,
        am.name,
        am.description,
        am.active,
        COALESCE(
            jsonb_build_object(
                'input', COALESCE(mmod.input_modalities, '[]'::jsonb),
                'output', COALESCE(mmod.output_modalities, '[]'::jsonb)
            ),
            jsonb_build_object('input', '[]'::jsonb, 'output', '[]'::jsonb)
        ) as modalities
    FROM all_models am
    LEFT JOIN model_modalities_data mmod ON mmod.model_id = am.model_id
),
user_profile AS (
    SELECT role FROM profiles p
    WHERE p.id = $2::uuid
),
user_departments AS (
    SELECT DISTINCT d.id, d.title as name, d.description
    FROM departments d
    JOIN profile_departments pd ON pd.department_id = d.id
    WHERE d.active = true
    AND pd.profile_id = $2::uuid
    AND pd.active = true
),
user_has_agent_access AS (
    -- Check if user has access to agent via department links
    SELECT EXISTS(
        SELECT 1 FROM agent_departments ad
        JOIN user_departments ud ON ud.id = ad.department_id::uuid
        WHERE ad.agent_id = $1::uuid AND ad.active = true
    ) OR EXISTS(
        SELECT 1 FROM profiles p
        WHERE p.id = $2::uuid AND p.role = 'superadmin'
    ) OR (
        -- Default agents (no department links) are accessible to all
        SELECT COUNT(*) FROM agent_departments ad
        WHERE ad.agent_id = $1::uuid AND ad.active = true
    ) = 0 as has_access
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
        jsonb_agg(mv.id::text ORDER BY mv.voice::text) as selected_voice_ids,
        jsonb_agg(mv.voice::text ORDER BY mv.voice::text) as selected_voices
    FROM agent_voices av
    JOIN model_voices mv ON mv.id = av.model_voice_id
    WHERE av.active = true AND mv.active = true
    GROUP BY av.agent_id
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
)
SELECT 
    ai.agent_id,
    ai.name,
    ai.description,
    COALESCE(aap.system_prompt, '') as system_prompt,
    COALESCE(aap.prompt_id, NULL)::text as prompt_id,
    ai.model_id,
    ai.active,
    ai.role,
    -- Selected options from junction tables
    COALESCE(ast.selected_temperature_level_id, NULL)::text as selected_temperature_level_id,
    COALESCE(ast.selected_temperature, 0.7) as temperature,
    COALESCE(asr.selected_reasoning_level_id, NULL)::text as selected_reasoning_level_id,
    COALESCE(asr.selected_reasoning, NULL)::text as reasoning,
    COALESCE(asv.selected_voice_ids, '[]'::jsonb) as selected_voice_ids,
    COALESCE(asv.selected_voices, '[]'::jsonb) as valid_voices,
    COALESCE(add.department_ids, ARRAY[]::text[]) as department_ids,
    COALESCE(vdd.dept_ids, ARRAY[]::text[]) as valid_department_ids,
    COALESCE(vdd.dept_mapping, '{}'::jsonb) as department_mapping,
    COALESCE(pmd.prompt_mapping, '{}'::jsonb) as prompt_mapping,
    COALESCE(adpl.department_prompt_links, '{}'::jsonb) as department_prompt_links,
    CASE 
        -- Default agents (no department_ids) are read-only for non-superadmin
        WHEN (COALESCE(add.department_ids, ARRAY[]::text[]) = ARRAY[]::text[] AND up.role != 'superadmin') THEN false
        WHEN up.role = 'superadmin' THEN true
        WHEN up.role IN ('admin', 'instructional') AND uhaa.has_access THEN true
        ELSE false
    END as can_edit,
    COALESCE(
        (SELECT jsonb_agg(
            jsonb_build_object(
                'created_at', dd.created_at,
                'model_id', dd.model_id,
                'content', dd.content
            ) ORDER BY dd.created_at DESC
        )
        FROM debug_data dd),
        '[]'::jsonb
    ) as debug_info,
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
        FROM all_models_with_modalities amwm
        WHERE amwm.active = true),
        '[]'::jsonb
    ) as valid_model_ids,
    -- Available options from model
    COALESCE(
        (SELECT mrl.reasoning_levels
        FROM model_reasoning_levels_data_with_ids mrl
        WHERE mrl.model_id = ai.model_id),
        '[]'::jsonb
    ) as reasoning_options,
    COALESCE(
        (SELECT mtl.temperature_lower
        FROM model_temperature_levels_data_with_ids mtl
        WHERE mtl.model_id = ai.model_id),
        0.0
    ) as temperature_lower,
    COALESCE(
        (SELECT mtl.temperature_upper
        FROM model_temperature_levels_data_with_ids mtl
        WHERE mtl.model_id = ai.model_id),
        1.0
    ) as temperature_upper,
    COALESCE(
        (SELECT mtl.temperature_levels
        FROM model_temperature_levels_data_with_ids mtl
        WHERE mtl.model_id = ai.model_id),
        '[]'::jsonb
    ) as temperature_levels,
    COALESCE(
        (SELECT mv.voices
        FROM model_voices_data mv
        WHERE mv.model_id = ai.model_id),
        '[]'::jsonb
    ) as available_voices
FROM agent_info ai
LEFT JOIN agent_active_prompt aap ON aap.agent_id = ai.agent_id
LEFT JOIN agent_departments_data add ON add.agent_id = ai.agent_id
LEFT JOIN agent_selected_temperature ast ON ast.agent_id = ai.agent_id
LEFT JOIN agent_selected_reasoning asr ON asr.agent_id = ai.agent_id
LEFT JOIN agent_selected_voices asv ON asv.agent_id = ai.agent_id
CROSS JOIN valid_departments_data vdd
CROSS JOIN prompt_mapping_data pmd
CROSS JOIN agent_department_prompt_links adpl
CROSS JOIN user_profile up
CROSS JOIN user_has_agent_access uhaa
WHERE uhaa.has_access = true

