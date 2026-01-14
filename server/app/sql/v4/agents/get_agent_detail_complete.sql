-- Get agent detail with prompts, departments, and access control
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
        WHERE proname = 'api_get_agent_detail_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_detail_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_agent_detail_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_agent_detail_v4_department AS (
    department_id text,
    name text,
    description text
);

CREATE TYPE types.q_get_agent_detail_v4_prompt AS (
    prompt_id text,
    system_prompt text,
    name text,
    description text,
    created_at text,
    updated_at text,
    department_ids text[],
    can_delete boolean
);

CREATE TYPE types.q_get_agent_detail_v4_department_prompt_link AS (
    department_id text,
    prompt_id text
);

CREATE TYPE types.q_get_agent_detail_v4_debug_info AS (
    created_at text,
    model_id text,
    content text
);

CREATE TYPE types.q_get_agent_detail_v4_model AS (
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

CREATE TYPE types.q_get_agent_detail_v4_reasoning_option AS (
    id text,
    reasoning_level text
);

CREATE TYPE types.q_get_agent_detail_v4_temperature_level AS (
    id text,
    temperature text,
    is_upper boolean
);

CREATE TYPE types.q_get_agent_detail_v4_available_voice AS (
    id text,
    voice text
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_detail_v4(
    agent_id uuid,
    profile_id uuid,
    draft_id uuid DEFAULT NULL
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
    departments types.q_get_agent_detail_v4_department[],
    prompts types.q_get_agent_detail_v4_prompt[],
    department_prompt_links types.q_get_agent_detail_v4_department_prompt_link[],
    debug_info types.q_get_agent_detail_v4_debug_info[],
    models types.q_get_agent_detail_v4_model[],
    reasoning_options types.q_get_agent_detail_v4_reasoning_option[],
    temperature_levels types.q_get_agent_detail_v4_temperature_level[],
    available_voices types.q_get_agent_detail_v4_available_voice[],
    draft_version int
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id,
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
agent_exists_check AS (
    -- Check if agent exists independently of access control
    SELECT EXISTS(
        SELECT 1 FROM agent_artifact WHERE id = (SELECT agent_id FROM params)
    )::boolean as agent_exists
),
agent_info AS (
    SELECT 
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) AS name,
        (SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1) AS description,
        (SELECT m.id::text FROM agent_models am JOIN models_resource m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) AS model_id,
        EXISTS (
            SELECT 1 FROM agent_flags af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id
              AND f.name = 'active'
              AND af.type = 'active'::type_agent_flags
              AND af.value = TRUE
        ) AS active,
        COALESCE(da.artifact::text, '') as role  -- Derive from agent's tools via artifact_resources
    FROM params x
    JOIN agents_resource a ON a.id = x.agent_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT ar.artifact::text
        FROM agent_tools at
        JOIN resource_tools rt ON rt.tool_id = at.tool_id
        JOIN artifact_resources ar ON ar.resource = rt.resource
        WHERE at.agent_id = a.id AND at.active = TRUE
        LIMIT 1
    ) da ON TRUE
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
    JOIN prompts_resource pr ON pr.id = ap.prompt_id
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
    JOIN prompts_resource pr ON pr.id = ap.prompt_id
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
    JOIN prompts_resource pr ON pr.id = adp.prompt_id
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
    JOIN run_artifact mr ON mr.agent_id = x.agent_id
    JOIN run_debug_info rdi ON rdi.run_id = mr.id
    JOIN debug_info_resource di ON di.id = rdi.debug_info_id
    JOIN run_models mrm ON mrm.run_id = mr.id
    WHERE mrm.active = true
    ORDER BY di.created_at DESC
    LIMIT 100
),
all_models AS (
    SELECT 
        id::text as model_id,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = model_artifact.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = model_artifact.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM model_flags mf WHERE mf.model_id = model_artifact.id AND mf.type = 'active'::type_model_flags AND mf.value = TRUE) as active
    FROM model_artifact
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
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            'System'
        ) as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT d.id, (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as name, (SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.id LIMIT 1)
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df WHERE df.department_id = d.id AND df.type = 'active'::type_department_flags AND df.value = true)
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
        JOIN profile_artifact p ON p.id = x.profile_id AND p.role = 'superadmin'::profile_role
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
        v.id::text as voice_id,
        v.voice::text as voice
    FROM agent_voices av
    JOIN voices_resource v ON v.id = av.voice_id
    WHERE av.active = true AND v.active = true
),
agent_selected_temperature AS (
    SELECT 
        atl.agent_id::text as agent_id,
        atl.temperature_level_id::text as selected_temperature_level_id,
        tl.temperature as selected_temperature
    FROM agent_temperature_levels atl
    JOIN temperature_levels_resource tl ON tl.id = atl.temperature_level_id
    WHERE atl.active = true AND tl.active = true
),
agent_selected_reasoning AS (
    SELECT 
        arl.agent_id::text as agent_id,
        arl.reasoning_level_id::text as selected_reasoning_level_id,
        rl.reasoning_level::text as selected_reasoning
    FROM agent_reasoning_levels arl
    JOIN reasoning_levels_resource rl ON rl.id = arl.reasoning_level_id
    WHERE arl.active = true AND rl.active = true
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
model_voices_data_flat AS (
    SELECT 
        mv.model_id::text as model_id,
        v.id::text as voice_id,
        v.voice::text as voice_value
    FROM model_voices mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE v.active = true
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
    -- Top-level agent fields (merged with draft payload if draft_id provided)
    ai.agent_id::text as agent_id,
    COALESCE(
        (SELECT payload->>'name' FROM draft_payload_data),
        ai.name
    )::text as name,
    COALESCE(
        (SELECT payload->>'description' FROM draft_payload_data),
        ai.description
    )::text as description,
    COALESCE(
        (SELECT payload->>'systemPrompt' FROM draft_payload_data),
        (SELECT payload->>'system_prompt' FROM draft_payload_data),
        COALESCE(aap.system_prompt, '')
    )::text as system_prompt,
    COALESCE(
        CASE 
            WHEN (SELECT payload->>'promptId' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'promptId' FROM draft_payload_data)
            WHEN (SELECT payload->>'prompt_id' FROM draft_payload_data) IS NOT NULL THEN
                (SELECT payload->>'prompt_id' FROM draft_payload_data)
            ELSE COALESCE(aap.prompt_id, NULL)
        END,
        NULL
    )::text as prompt_id,
    COALESCE(
        (SELECT payload->>'modelId' FROM draft_payload_data),
        (SELECT payload->>'model_id' FROM draft_payload_data),
        ai.model_id
    )::text as model_id,
    COALESCE(
        (SELECT (payload->>'active')::boolean FROM draft_payload_data),
        ai.active
    )::boolean as active,
    COALESCE(
        (SELECT payload->>'role' FROM draft_payload_data),
        ai.role
    )::text as role,
    -- Selected options from junction tables (merged with draft payload if draft_id provided)
    COALESCE(
        (SELECT payload->>'model_temperature_level_id' FROM draft_payload_data),
        COALESCE(ast.selected_temperature_level_id, '')
    )::text as selected_temperature_level_id,
    COALESCE(ast.selected_temperature, 0.7)::float as temperature,
    COALESCE(
        (SELECT payload->>'model_reasoning_level_id' FROM draft_payload_data),
        COALESCE(asr.selected_reasoning_level_id, '')
    )::text as selected_reasoning_level_id,
    COALESCE(asr.selected_reasoning, '')::text as reasoning,
    COALESCE(
        CASE 
            WHEN (SELECT payload->'model_voice_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'model_voice_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'model_voice_ids' FROM draft_payload_data)))::text[]
            ELSE COALESCE((SELECT array_agg(asv2.voice_id::text ORDER BY asv2.voice) FROM agent_selected_voices asv2 WHERE asv2.agent_id = ai.agent_id), ARRAY[]::text[])
        END,
        ARRAY[]::text[]
    )::text[] as selected_voice_ids,
    COALESCE((SELECT array_agg(asv3.voice::text ORDER BY asv3.voice) FROM agent_selected_voices asv3 WHERE asv3.agent_id = ai.agent_id), ARRAY[]::text[])::text[] as valid_voices,
    COALESCE(
        CASE 
            WHEN (SELECT payload->'departmentIds' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'departmentIds' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'departmentIds' FROM draft_payload_data)))::text[]
            WHEN (SELECT payload->'department_ids' FROM draft_payload_data) IS NOT NULL AND jsonb_typeof((SELECT payload->'department_ids' FROM draft_payload_data)) = 'array' THEN
                ARRAY(SELECT jsonb_array_elements_text((SELECT payload->'department_ids' FROM draft_payload_data)))::text[]
            ELSE COALESCE(add.department_ids, ARRAY[]::text[])
        END,
        ARRAY[]::text[]
    )::text[] as department_ids,
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
            )::types.q_get_agent_detail_v4_department
            ORDER BY vdd.department_name
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v4_department[]
    ) as departments,
    COALESCE(
        ARRAY_AGG(
            (pmd.prompt_id, pmd.system_prompt, pmd.prompt_name, pmd.prompt_description,
             pmd.prompt_created_at::text, pmd.prompt_updated_at::text,
             COALESCE(pmd.department_ids, ARRAY[]::text[]), pmd.can_delete
            )::types.q_get_agent_detail_v4_prompt
            ORDER BY pmd.prompt_created_at
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v4_prompt[]
    ) as prompts,
    COALESCE(
        ARRAY_AGG(
            (adpl.department_id, adpl.prompt_id
            )::types.q_get_agent_detail_v4_department_prompt_link
            ORDER BY adpl.department_id, adpl.prompt_id
        ) FILTER (WHERE uhaa.has_access = true AND adpl.department_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v4_department_prompt_link[]
    ) as department_prompt_links,
    COALESCE(
        ARRAY_AGG(
            (dd.created_at::text, dd.model_id, dd.content
            )::types.q_get_agent_detail_v4_debug_info
            ORDER BY dd.created_at DESC
        ) FILTER (WHERE uhaa.has_access = true AND dd.created_at IS NOT NULL),
        '{}'::types.q_get_agent_detail_v4_debug_info[]
    ) as debug_info,
    COALESCE(
        ARRAY_AGG(
            (ma.model_id, ma.name, ma.description,
             ma.input_modalities, ma.output_modalities,
             ma.temperature_lower, ma.temperature_upper,
             ma.temperature_levels, ma.reasoning_options, ma.available_voices
            )::types.q_get_agent_detail_v4_model
            ORDER BY ma.name
        ) FILTER (WHERE uhaa.has_access = true),
        '{}'::types.q_get_agent_detail_v4_model[]
    ) as models,
    COALESCE(
        ARRAY_AGG(
            (mrl_selected.reasoning_level_id, mrl_selected.reasoning_level_value
            )::types.q_get_agent_detail_v4_reasoning_option
            ORDER BY mrl_selected.reasoning_level_value
        ) FILTER (WHERE uhaa.has_access = true AND mrl_selected.reasoning_level_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v4_reasoning_option[]
    ) as reasoning_options,
    COALESCE(
        ARRAY_AGG(
            (mtl_selected.temperature_level_id, mtl_selected.temperature_value, mtl_selected.is_upper
            )::types.q_get_agent_detail_v4_temperature_level
            ORDER BY mtl_selected.temperature_value::float
        ) FILTER (WHERE uhaa.has_access = true AND mtl_selected.temperature_level_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v4_temperature_level[]
    ) as temperature_levels,
    COALESCE(
        ARRAY_AGG(
            (mvf_selected.voice_id, mvf_selected.voice_value
            )::types.q_get_agent_detail_v4_available_voice
            ORDER BY mvf_selected.voice_value
        ) FILTER (WHERE uhaa.has_access = true AND mvf_selected.voice_id IS NOT NULL),
        '{}'::types.q_get_agent_detail_v4_available_voice[]
    ) as available_voices,
    COALESCE((SELECT draft_version FROM draft_payload_data), 0)::int as draft_version
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
         up.role, uhaa.has_access, uhaa.has_access
LIMIT 1
$$;