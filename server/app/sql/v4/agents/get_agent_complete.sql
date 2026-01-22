-- Unified get agent function - handles both new (agent_id = NULL) and detail (agent_id provided)
-- Converted to function with composite types
-- Follows ARTIFACT.md
-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_get_agent_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_agent_v4(%s)', r.sig);
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
        WHERE typname LIKE 'q_get_agent_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate types
CREATE TYPE types.q_get_agent_v4_department AS (
    department_id uuid,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_model AS (
    model_id uuid,
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

CREATE TYPE types.q_get_agent_v4_prompt AS (
    prompt_id uuid,
    system_prompt text,
    name text,
    description text,
    created_at timestamptz,
    updated_at timestamptz,
    department_ids uuid[],
    can_delete boolean,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_name_resource AS (
    id uuid,
    name text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_description_resource AS (
    id uuid,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_flag_resource AS (
    id uuid,
    name text,
    description text,
    icon_id uuid,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_instructions_resource AS (
    id uuid,
    template text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_model_resource AS (
    id uuid,
    name text,
    description text,
    active boolean,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_prompt_resource AS (
    id uuid,
    system_prompt text,
    name text,
    description text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_reasoning_level_resource AS (
    id uuid,
    reasoning_level text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_temperature_level_resource AS (
    id uuid,
    temperature real,
    is_upper boolean,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_voice_resource AS (
    id uuid,
    voice text,
    generated boolean
);

CREATE TYPE types.q_get_agent_v4_tool AS (
    tool_id uuid,
    name text,
    description text,
    generated boolean,
    group_id uuid
);

-- 4) Recreate function
CREATE OR REPLACE FUNCTION api_get_agent_v4(
    profile_id uuid,
    agent_id uuid DEFAULT NULL,
    descriptions_search text DEFAULT NULL,
    prompts_search text DEFAULT NULL,
    instructions_search text DEFAULT NULL,
    draft_id uuid DEFAULT NULL,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    -- Required fields (first 5)
    actor_name text,
    agent_exists boolean,
    can_edit boolean,
    disabled_reason text,
    draft_version int,
    group_id uuid,
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_agent_v4_name_resource,
    show_name boolean,
    name_agent_id uuid,
    name_required boolean,
    name_suggestions uuid[],
    names types.q_get_agent_v4_name_resource[],
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_agent_v4_description_resource,
    show_description boolean,
    description_agent_id uuid,
    description_required boolean,
    description_suggestions uuid[],
    descriptions types.q_get_agent_v4_description_resource[],
    -- Single-select resources: model
    model_id uuid,
    model_resource types.q_get_agent_v4_model_resource,
    show_models boolean,
    models_agent_id uuid,
    models_required boolean,
    model_suggestions uuid[],
    models types.q_get_agent_v4_model[],
    -- Single-select resources: prompt
    prompt_id uuid,
    prompt_resource types.q_get_agent_v4_prompt_resource,
    show_prompts boolean,
    prompts_agent_id uuid,
    prompts_required boolean,
    prompt_suggestions uuid[],
    prompts types.q_get_agent_v4_prompt[],
    -- Single-select resources: instructions
    instructions_id uuid,
    instructions_resource types.q_get_agent_v4_instructions_resource,
    show_instructions boolean,
    instructions_agent_id uuid,
    instructions_required boolean,
    instructions_suggestions uuid[],
    instructions types.q_get_agent_v4_instructions_resource[],
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_agent_v4_flag_resource,
    show_flag boolean,
    flag_agent_id uuid,
    flag_required boolean,
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_agent_v4_department[],
    show_departments boolean,
    departments_agent_id uuid,
    departments_required boolean,
    department_suggestions uuid[],
    departments types.q_get_agent_v4_department[],
    -- Single-select resources: reasoning_levels
    reasoning_level_id uuid,
    reasoning_level_resource types.q_get_agent_v4_reasoning_level_resource,
    show_reasoning_levels boolean,
    reasoning_levels_agent_id uuid,
    reasoning_levels_required boolean,
    reasoning_level_suggestions uuid[],
    reasoning_levels types.q_get_agent_v4_reasoning_level_resource[],
    -- Single-select resources: temperature_levels
    temperature_level_id uuid,
    temperature_level_resource types.q_get_agent_v4_temperature_level_resource,
    show_temperature_levels boolean,
    temperature_levels_agent_id uuid,
    temperature_levels_required boolean,
    temperature_level_suggestions uuid[],
    temperature_levels types.q_get_agent_v4_temperature_level_resource[],
    -- Multi-select resources: voices
    voice_ids uuid[],
    voice_resources types.q_get_agent_v4_voice_resource[],
    show_voices boolean,
    voices_agent_id uuid,
    voices_required boolean,
    voice_suggestions uuid[],
    voices types.q_get_agent_v4_voice_resource[],
    -- Multi-select resources: tools
    tool_ids uuid[],
    tool_resources types.q_get_agent_v4_tool[],
    show_tools boolean,
    tools_agent_id uuid,
    tools_required boolean,
    tool_suggestions uuid[],
    tools types.q_get_agent_v4_tool[]
)
LANGUAGE sql
STABLE
AS $$
WITH params AS (
    SELECT 
        agent_id AS agent_id,
        profile_id AS profile_id,
        descriptions_search AS descriptions_search,
        prompts_search AS prompts_search,
        instructions_search AS instructions_search,
        draft_id AS draft_id,
        COALESCE(mcp, false) AS mcp
),
-- Conditional: Only check agent existence if agent_id provided
agent_exists_check AS (
    SELECT 
        CASE 
            WHEN (SELECT agent_id FROM params) IS NULL THEN NULL::boolean
            ELSE EXISTS(SELECT 1 FROM agent_artifact WHERE id = (SELECT agent_id FROM params))::boolean
        END as agent_exists
),
-- Draft data is now stored in draft_* junction tables, not in payload
draft_payload_data AS (
    SELECT 
        NULL::jsonb as payload
    FROM params x
    WHERE x.draft_id IS NOT NULL
    LIMIT 1
),
-- Get group_id from draft (should always exist after migration, but handle NULL case)
draft_group_data AS (
    SELECT 
        COALESCE(
            d.group_id,
            (SELECT id FROM groups ORDER BY created_at DESC LIMIT 1)
        ) as group_id
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    -- Always return at least one row (use COALESCE to handle NULL draft_id case)
    WHERE TRUE
    LIMIT 1
),
draft_version_data AS (
    -- Keep draft_version for client-side expected_version sync to avoid unintended draft forks.
    SELECT d.version as draft_version
    FROM params x
    LEFT JOIN drafts d ON d.id = x.draft_id
    WHERE TRUE
    LIMIT 1
),
user_profile AS (
    SELECT 
        (SELECT r.role FROM profile_roles pr_j 
         JOIN roles_resource r ON pr_j.role_id = r.id 
         WHERE pr_j.profile_id = p.id 
         LIMIT 1) as role,
        COALESCE((SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1), '') as actor_name
    FROM params x
    JOIN profile_artifact p ON p.id = x.profile_id
),
user_departments AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
-- Conditional: Get agent department data only if agent_id provided
agent_departments_data AS (
    SELECT 
        ad.agent_id,
        ARRAY_AGG(ad.department_id ORDER BY ad.created_at) as department_ids
    FROM params x
    JOIN agent_departments ad ON ad.agent_id = x.agent_id AND ad.active = true
    WHERE x.agent_id IS NOT NULL
    GROUP BY ad.agent_id
),
agent_department_access_check AS (
    SELECT 
        a.id as agent_id,
        CASE 
            WHEN up.role = 'superadmin'::profile_role THEN true
            WHEN EXISTS (
                SELECT 1 FROM agent_departments ad 
                WHERE ad.agent_id = a.id 
                AND ad.active = true 
                AND ad.department_id IN (SELECT department_id FROM user_departments)
            ) THEN true
            WHEN NOT EXISTS (
                SELECT 1 FROM agent_departments ad3 
                WHERE ad3.agent_id = a.id 
                AND ad3.active = true
            ) THEN true
            ELSE false
        END as has_access
    FROM params x
    JOIN agent_artifact a ON a.id = x.agent_id
    CROSS JOIN user_profile up
    WHERE x.agent_id IS NOT NULL
),
department_mapping_data AS (
    SELECT
        d.id as department_id,
        (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.department_id LIMIT 1) as name,
        COALESCE((SELECT d2.description FROM department_descriptions dd JOIN descriptions_resource d2 ON dd.description_id = d2.id WHERE dd.department_id = d.department_id LIMIT 1), '') as description,
        COALESCE(d.generated, false) as generated
    FROM params x
    CROSS JOIN user_profile up
    JOIN departments_resource d ON (
        -- Only include departments with active flag AND user is linked to them
        EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
        AND
        EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
    )
),
primary_department_id_data AS (
    SELECT department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.is_primary = TRUE
    LIMIT 1
),
-- Active departments for user (departments with active flag that user is linked to)
active_departments_data AS (
    SELECT ARRAY_AGG(DISTINCT d.id) as department_ids
    FROM params x
    JOIN departments_resource d ON EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active' AND df.value = true)
    WHERE EXISTS (SELECT 1 FROM profile_departments pd WHERE pd.department_id = d.id AND pd.profile_id = x.profile_id AND pd.active = true)
),
-- Tool existence check for required resources
tools_existence_check AS (
    SELECT 
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'names'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as names_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'descriptions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as descriptions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'models'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as models_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'prompts'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as prompts_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'instructions'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as instructions_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'departments'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as departments_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'reasoning_levels'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as reasoning_levels_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'temperature_levels'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as temperature_levels_has_tools,
        EXISTS (
            SELECT 1 FROM resource_tools rt
            JOIN tool_artifact t ON t.id = rt.tool_id
            WHERE rt.resource = 'voices'::resources 
              AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as voices_has_tools,
        EXISTS (
            SELECT 1 FROM tool_artifact t
            WHERE EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
        ) as tools_has_tools
    FROM params x
),
-- Missing tools check for can_edit and disabled_reason
missing_tools_check AS (
    SELECT 
        ARRAY_REMOVE(ARRAY[
            CASE WHEN NOT tec.names_has_tools THEN 'name' ELSE NULL END,
            CASE WHEN NOT tec.models_has_tools THEN 'model' ELSE NULL END,
            CASE WHEN NOT tec.prompts_has_tools THEN 'prompt' ELSE NULL END,
            CASE WHEN NOT tec.instructions_has_tools THEN 'instructions' ELSE NULL END
        ]::text[], NULL) as missing_resources
    FROM tools_existence_check tec
),
-- Permissions check
permissions_final AS (
    SELECT 
        CASE 
            WHEN (SELECT agent_id FROM params) IS NULL THEN
                -- New mode: check if user has departments
                CASE 
                    WHEN EXISTS (SELECT 1 FROM user_departments) THEN true
                    ELSE false
                END
            ELSE
                -- Detail mode: check agent access
                COALESCE((SELECT has_access FROM agent_department_access_check), false)
        END as can_edit,
        CASE 
            WHEN (SELECT agent_id FROM params) IS NULL THEN
                -- New mode: check for missing tools
                CASE 
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                        'No tool configured for ' || array_to_string(mtc.missing_resources, ', ') || '. Therefore we cannot proceed ahead.'
                    ELSE NULL
                END
            ELSE
                -- Detail mode: check agent access and missing tools
                CASE 
                    WHEN NOT COALESCE((SELECT has_access FROM agent_department_access_check), false) THEN
                        'You don''t have access to this agent. It may be restricted to other departments.'
                    WHEN array_length(mtc.missing_resources, 1) > 0 THEN
                        'No tool configured for ' || array_to_string(mtc.missing_resources, ', ') || '. Therefore we cannot proceed ahead.'
                    ELSE NULL
                END
        END as disabled_reason
    FROM params x
    CROSS JOIN user_profile up
    CROSS JOIN missing_tools_check mtc
    LEFT JOIN agent_department_access_check adac ON true
),
ui_flags AS (
    SELECT 
        -- Single-select resource flags (based on whether options exist)
        true as show_name,  -- Always show name picker
        true as show_description,  -- Always show description picker
        true as show_models,  -- Always show models picker
        true as show_prompts,  -- Always show prompts picker
        true as show_instructions,  -- Always show instructions picker
        true as show_flag,  -- Flag is a boolean toggle that should be shown
        true as show_reasoning_levels,  -- Show if model has reasoning options
        true as show_temperature_levels,  -- Show if model has temperature levels
        true as show_voices,  -- Show if model has voices
        -- Multi-select resource flags (based on business logic)
        CASE 
            WHEN (SELECT COUNT(*) FROM department_mapping_data) > 0 THEN true
            ELSE false
        END as show_departments,
        true as show_tools  -- Always show tools picker if tools exist (checked later in SELECT)
    FROM params x
    CROSS JOIN user_profile up
),
-- Resource data CTEs - query from agent_* tables or draft_* tables if draft_id provided
name_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dn.names_id FROM draft_names dn WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT an.name_id FROM agent_names an WHERE an.agent_id = (SELECT agent_id FROM params) LIMIT 1)
        ) as name_id,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_agent_v4_name_resource FROM draft_names dn JOIN names_resource n ON dn.names_id = n.id WHERE dn.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_name_resource,
        (SELECT ROW(n.id, n.name, COALESCE(n.generated, false))::types.q_get_agent_v4_name_resource FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = (SELECT agent_id FROM params) LIMIT 1) as agent_name_resource
    FROM params
),
description_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dd.descriptions_id FROM draft_descriptions dd WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ad.description_id FROM agent_descriptions ad WHERE ad.agent_id = (SELECT agent_id FROM params) LIMIT 1)
        ) as description_id,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_agent_v4_description_resource FROM draft_descriptions dd JOIN descriptions_resource d ON dd.descriptions_id = d.id WHERE dd.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_description_resource,
        (SELECT ROW(d.id, d.description, COALESCE(d.generated, false))::types.q_get_agent_v4_description_resource FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = (SELECT agent_id FROM params) LIMIT 1) as agent_description_resource
    FROM params
),
flag_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT df.flags_id FROM draft_flags df WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT af.flag_id FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = (SELECT agent_id FROM params) AND f.name = 'active' AND af.value = TRUE LIMIT 1)
        ) as active_flag_id,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_agent_v4_flag_resource FROM draft_flags df JOIN flags_resource f ON df.flags_id = f.id WHERE df.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_flag_resource,
        (SELECT ROW(f.id, f.name, f.description, f.icon_id, COALESCE(f.generated, false))::types.q_get_agent_v4_flag_resource FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = (SELECT agent_id FROM params) AND f.name = 'active' AND af.value = TRUE LIMIT 1) as agent_flag_resource
    FROM params
),
instructions_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT dinst.instructions_id FROM draft_instructions dinst WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1),
            (SELECT ai.instruction_id FROM agent_instructions ai WHERE ai.agent_id = (SELECT agent_id FROM params) LIMIT 1)
        ) as instructions_id,
        (SELECT ROW(inst.id, inst.template, COALESCE(inst.generated, false))::types.q_get_agent_v4_instructions_resource FROM draft_instructions dinst JOIN instructions_resource inst ON dinst.instructions_id = inst.id WHERE dinst.draft_id = (SELECT draft_id FROM params) LIMIT 1) as draft_instructions_resource,
        (SELECT ROW(inst.id, inst.template, COALESCE(inst.generated, false))::types.q_get_agent_v4_instructions_resource FROM agent_instructions ai JOIN instructions_resource inst ON ai.instruction_id = inst.id WHERE ai.agent_id = (SELECT agent_id FROM params) LIMIT 1) as agent_instructions_resource
    FROM params
),
-- Agent info (for detail mode)
agent_info AS (
    SELECT 
        a.id::uuid as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) AS name,
        (SELECT d.description FROM agent_descriptions ad JOIN descriptions_resource d ON ad.description_id = d.id WHERE ad.agent_id = a.id LIMIT 1) AS description,
        (SELECT m.id FROM agent_models am JOIN model_artifact m ON am.model_id = m.id WHERE am.agent_id = a.id LIMIT 1) AS model_id,
        EXISTS (
            SELECT 1 FROM agent_flags af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = a.id
              AND f.name = 'active'
              AND af.value = TRUE
        ) AS active,
        COALESCE(NULL::artifacts::text, 'assistant') as role  -- Derive from agent's tools via artifact_resources, default to 'assistant'
    FROM params x
    JOIN agent_artifact a ON a.id = x.agent_id
    LEFT JOIN LATERAL (
        SELECT DISTINCT ar.artifact::text
        FROM agent_tools at
        JOIN resource_tools rt ON rt.tool_id = at.tool_id
        JOIN artifact_resources ar ON ar.resource = rt.resource
        WHERE at.agent_id = a.id AND at.active = TRUE
        LIMIT 1
    ) da ON TRUE
    WHERE x.agent_id IS NOT NULL
),
-- Agent active prompt (for detail mode)
agent_active_prompt AS (
    SELECT 
        ap.agent_id::uuid as agent_id,
        ap.prompt_id::uuid as prompt_id,
        pr.system_prompt,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id AND ap.active = true
    JOIN prompts_resource pr ON pr.id = ap.prompt_id
    WHERE x.agent_id IS NOT NULL
    LIMIT 1
),
-- Model resource data (for detail mode)
model_resource_data AS (
    SELECT 
        ai.model_id as model_id,
        (SELECT ROW(m.id, (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), ''), EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'active' AND mf.value = TRUE), false)::types.q_get_agent_v4_model_resource FROM model_artifact m WHERE m.id = ai.model_id LIMIT 1) as model_resource
    FROM agent_info ai
    WHERE ai.agent_id IS NOT NULL AND ai.model_id IS NOT NULL
    LIMIT 1
),
-- Prompt resource data (for detail mode)
prompt_resource_data AS (
    SELECT 
        aap.prompt_id as prompt_id,
        (SELECT ROW(pr.id, pr.system_prompt, COALESCE(pr.name, ''), COALESCE(pr.description, ''), COALESCE(pr.generated, false))::types.q_get_agent_v4_prompt_resource FROM prompts_resource pr WHERE pr.id = aap.prompt_id LIMIT 1) as prompt_resource
    FROM agent_active_prompt aap
    WHERE aap.prompt_id IS NOT NULL
    LIMIT 1
),
-- Name suggestions: linked to agents OR same group with generated=true
name_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(an.name_id ORDER BY an.created_at DESC)
             FROM (
                 SELECT DISTINCT an.name_id, MAX(an.created_at) as created_at
                 FROM agent_names an
                 JOIN names_resource n ON n.id = an.name_id
                 CROSS JOIN draft_group_data dgd
                 WHERE an.name_id IS NOT NULL
                   AND n.name IS NOT NULL
                   AND n.name != ''
                   AND (
                       -- Option 1: Linked to agents (agent_names junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       an.generated = false
                       OR
                       (
                           an.generated = true
                           AND n.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = n.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY an.name_id
                 ORDER BY MAX(an.created_at) DESC
                 LIMIT 20
             ) an),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Description suggestions: linked to agents OR same group with generated=true
description_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ad.description_id ORDER BY ad.created_at DESC)
             FROM (
                 SELECT DISTINCT ad.description_id, MAX(ad.created_at) as created_at
                 FROM agent_descriptions ad
                 JOIN descriptions_resource d ON d.id = ad.description_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ad.description_id IS NOT NULL
                   AND d.description IS NOT NULL
                   AND d.description != ''
                   AND (
                       -- Option 1: Linked to agents (agent_descriptions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ad.generated = false
                       OR
                       (
                           ad.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ad.description_id
                 ORDER BY MAX(ad.created_at) DESC
                 LIMIT 20
             ) ad),
            ARRAY[]::uuid[]
        ) as description_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Instructions suggestions: linked to agents OR same group with generated=true
instructions_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ai.instruction_id ORDER BY ai.created_at DESC)
             FROM (
                 SELECT DISTINCT ai.instruction_id, MAX(ai.created_at) as created_at
                 FROM agent_instructions ai
                 JOIN instructions_resource i ON i.id = ai.instruction_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ai.instruction_id IS NOT NULL
                   AND i.active = true
                   AND i.template IS NOT NULL
                   AND i.template != ''
                   AND (
                       -- Option 1: Linked to agents (agent_instructions junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ai.generated = false
                       OR
                       (
                           ai.generated = true
                           AND i.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = i.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ai.instruction_id
                 ORDER BY MAX(ai.created_at) DESC
                 LIMIT 20
             ) ai),
            ARRAY[]::uuid[]
        ) as instructions_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Department suggestions: linked to agents OR same group with generated=true
department_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(ad.department_id ORDER BY ad.created_at DESC)
             FROM (
                 SELECT DISTINCT ad.department_id, MAX(ad.created_at) as created_at
                 FROM agent_departments ad
                 JOIN departments_resource d ON d.id = ad.department_id
                 CROSS JOIN draft_group_data dgd
                 WHERE ad.department_id IS NOT NULL
                   AND EXISTS (SELECT 1 FROM department_flags df JOIN flags_resource f ON df.flag_id = f.id WHERE df.department_id = d.department_id AND f.name = 'active'
                         AND df.value = true
                   )
                   AND (
                       -- Option 1: Linked to agents (agent_departments junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       ad.generated = false
                       OR
                       (
                           ad.generated = true
                           AND d.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = d.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY ad.department_id
                 ORDER BY MAX(ad.created_at) DESC
                 LIMIT 20
             ) ad),
            ARRAY[]::uuid[]
        ) as department_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Tool mapping data (selected tools for agent)
tool_mapping_data AS (
    SELECT 
        t.id as tool_id,
        (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), '') as description,
        COALESCE(at.generated, false) as generated,
        COALESCE(t.group_id, NULL) as group_id
    FROM params x
    LEFT JOIN agent_tools at ON at.agent_id = x.agent_id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id
    WHERE x.agent_id IS NOT NULL
      AND t.id IS NOT NULL
      AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
),
-- Tool IDs (selected tool IDs for agent)
tool_ids_data AS (
    SELECT 
        CASE 
            WHEN (SELECT agent_id FROM params) IS NULL THEN ARRAY[]::uuid[]
            ELSE COALESCE(
                (SELECT ARRAY_AGG(at.tool_id ORDER BY at.created_at)
                 FROM agent_tools at
                 JOIN tool_artifact t ON t.id = at.tool_id
                 WHERE at.agent_id = (SELECT agent_id FROM params)
                   AND at.active = true
                   AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)),
                ARRAY[]::uuid[]
            )
        END as tool_ids
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Tool suggestions: linked to agents via agent_tools OR same group with generated=true
tool_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(at.tool_id ORDER BY at.created_at DESC)
             FROM (
                 SELECT DISTINCT at.tool_id, MAX(at.created_at) as created_at
                 FROM agent_tools at
                 JOIN tool_artifact t ON t.id = at.tool_id
                 CROSS JOIN draft_group_data dgd
                 WHERE at.tool_id IS NOT NULL
                   AND at.active = true
                   AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
                   AND (
                       -- Option 1: Linked to agents via agent_tools (validated by usage)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       at.generated = false
                       OR
                       (
                           at.generated = true
                           AND t.generated = true
                           AND t.group_id = dgd.group_id
                       )
                   )
                 GROUP BY at.tool_id
                 ORDER BY MAX(at.created_at) DESC
                 LIMIT 20
             ) at),
            ARRAY[]::uuid[]
        ) as tool_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- All available tools (filtered by active flag)
tools_data AS (
    SELECT 
        t.id as tool_id,
        (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), '') as description,
        COALESCE(t.generated, false) as generated,
        COALESCE(t.group_id, NULL) as group_id
    FROM params x
    JOIN tool_artifact t ON EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
    ORDER BY t.created_at DESC
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
names_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (n.id, n.name, COALESCE(n.generated, false))::types.q_get_agent_v4_name_resource
                    ORDER BY array_position(nsd.name_suggestions, n.id)
                )
                FROM name_suggestions_data nsd
                CROSS JOIN LATERAL unnest(nsd.name_suggestions) AS suggestion_id
                JOIN names_resource n ON n.id = suggestion_id
                WHERE n.name IS NOT NULL AND n.name != ''
            ),
            ARRAY[]::types.q_get_agent_v4_name_resource[]
        ) as names
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
descriptions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (d.id, d.description, COALESCE(d.generated, false))::types.q_get_agent_v4_description_resource
                    ORDER BY array_position(dsd.description_suggestions, d.id)
                )
                FROM description_suggestions_data dsd
                CROSS JOIN LATERAL unnest(dsd.description_suggestions) AS suggestion_id
                JOIN descriptions_resource d ON d.id = suggestion_id
                WHERE d.description IS NOT NULL AND d.description != ''
            ),
            ARRAY[]::types.q_get_agent_v4_description_resource[]
        ) as descriptions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
instructions_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (i.id, i.template, COALESCE(i.generated, false))::types.q_get_agent_v4_instructions_resource
                    ORDER BY array_position(isd.instructions_suggestions, i.id)
                )
                FROM instructions_suggestions_data isd
                CROSS JOIN LATERAL unnest(isd.instructions_suggestions) AS suggestion_id
                JOIN instructions_resource i ON i.id = suggestion_id
                WHERE i.template IS NOT NULL AND i.template != ''
            ),
            ARRAY[]::types.q_get_agent_v4_instructions_resource[]
        ) as instructions
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Names: linked to agents OR same group with generated=true
names_data AS (
    SELECT DISTINCT
        n.id,
        n.name,
        COALESCE(n.generated, false) as generated
    FROM names_resource n
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        -- Always include selected name_id if it exists
        n.id = (SELECT name_id FROM name_resource_data)
        OR (
            (
                -- Option 1: Linked to agents (agent_names junction table means it's used)
                EXISTS (
                    SELECT 1 FROM agent_names an
                    WHERE an.name_id = n.id
                )
                OR
                -- Option 2: Linked to same group with generated=true
                (
                    n.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls c
                        JOIN message_runs mr ON mr.message_id = c.message_id
                        JOIN group_runs gr ON gr.run_id = mr.run_id
                        WHERE c.id = n.call_id
                          AND gr.group_id = dgd.group_id
                    )
                )
            )
            AND n.name IS NOT NULL
            AND n.name != ''
        )
    ORDER BY n.name
),
-- Descriptions: linked to agents OR same group with generated=true
descriptions_data AS (
    SELECT DISTINCT
        d.id,
        d.description,
        COALESCE(d.generated, false) as generated
    FROM descriptions_resource d
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        -- Always include selected description_id if it exists
        d.id = (SELECT description_id FROM description_resource_data)
        OR (
            (
                -- Option 1: Linked to agents (agent_descriptions junction table means it's used)
                EXISTS (
                    SELECT 1 FROM agent_descriptions ad
                    WHERE ad.description_id = d.id
                )
                OR
                -- Option 2: Linked to same group with generated=true
                (
                    d.generated = true
                    AND EXISTS (
                        SELECT 1 FROM calls c
                        JOIN message_runs mr ON mr.message_id = c.message_id
                        JOIN group_runs gr ON gr.run_id = mr.run_id
                        WHERE c.id = d.call_id
                          AND gr.group_id = dgd.group_id
                    )
                )
            )
            -- Search filter: if descriptions_search provided, match description text
            AND (p.descriptions_search IS NULL OR p.descriptions_search = '' OR
                 LOWER(d.description) LIKE '%' || LOWER(p.descriptions_search) || '%')
            AND d.description IS NOT NULL
            AND d.description != ''
        )
    ORDER BY d.description
),
-- Instructions: linked to agents OR same group with generated=true
instructions_data AS (
    SELECT DISTINCT
        i.id,
        i.template,
        COALESCE(i.generated, false) as generated
    FROM instructions_resource i
    CROSS JOIN params p
    CROSS JOIN draft_group_data dgd
    WHERE 
        i.active = true
        AND (
            -- Always include selected instructions_id if it exists
            i.id = (SELECT instructions_id FROM instructions_resource_data)
            OR (
                (
                    -- Option 1: Linked to agents (agent_instructions junction table means it's used)
                    EXISTS (
                        SELECT 1 FROM agent_instructions ai
                        WHERE ai.instruction_id = i.id
                    )
                    OR
                    -- Option 2: Linked to same group with generated=true
                    (
                        i.generated = true
                        AND EXISTS (
                            SELECT 1 FROM calls c
                            JOIN message_runs mr ON mr.message_id = c.message_id
                            JOIN group_runs gr ON gr.run_id = mr.run_id
                            WHERE c.id = i.call_id
                              AND gr.group_id = dgd.group_id
                        )
                    )
                )
                -- Search filter: if instructions_search provided, match template text
                AND (p.instructions_search IS NULL OR p.instructions_search = '' OR
                     LOWER(i.template) LIKE '%' || LOWER(p.instructions_search) || '%')
                AND i.template IS NOT NULL
                AND i.template != ''
            )
        )
    ORDER BY i.template
),
-- Flags (all available flag options)
flags_data AS (
    SELECT DISTINCT
        f.id,
        f.name,
        f.description,
        f.icon_id,
        COALESCE(f.generated, false) as generated
    FROM flags_resource f
    CROSS JOIN params p
    WHERE 
        -- Always include selected active_flag_id if it exists
        f.id = (SELECT active_flag_id FROM flag_resource_data)
        OR (SELECT active_flag_id FROM flag_resource_data) IS NULL
    ORDER BY f.name
),
-- Models data (all available models for user)
user_departments_for_models AS (
    SELECT DISTINCT pd.department_id
    FROM params x
    JOIN profile_departments pd ON pd.profile_id = x.profile_id AND pd.active = true
),
valid_models AS (
    SELECT 
        m.id::uuid as model_id,
        (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1) as name,
        COALESCE((SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), '') as description,
        EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'active' AND mf.value = TRUE) as active
    FROM model_artifact m
    LEFT JOIN model_departments md ON md.model_id = m.id AND md.active = true
    WHERE EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'active' AND mf.value = true)
    GROUP BY m.id, (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1), (SELECT d.description FROM model_descriptions md JOIN descriptions_resource d ON md.description_id = d.id WHERE md.model_id = m.id LIMIT 1), EXISTS (SELECT 1 FROM model_flags mf JOIN flags_resource f ON mf.flag_id = f.id WHERE mf.model_id = m.id AND f.name = 'active' AND mf.value = TRUE)
    HAVING 
        COUNT(md.model_id) FILTER (WHERE md.department_id IN (SELECT department_id FROM user_departments_for_models)) > 0
        OR NOT EXISTS (SELECT 1 FROM model_departments md2 WHERE md2.model_id = m.id AND md2.active = true)
    ORDER BY (SELECT n.name FROM model_names mn JOIN names_resource n ON mn.name_id = n.id WHERE mn.model_id = m.id LIMIT 1)
),
model_modalities_data AS (
    SELECT 
        mm.model_id::uuid as model_id,
        mr.modality::text as modality,
        CASE WHEN mm.type = 'input'::type_model_modalities THEN true ELSE false END as is_input
    FROM model_modalities mm
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE mm.active = true AND mr.active = true
),
model_temperature_levels_data_with_ids AS (
    SELECT 
        mtl.model_id::uuid as model_id,
        tl.id::uuid as temperature_level_id,
        tl.temperature::text as temperature_value,
        tl.is_upper::boolean as is_upper
    FROM model_temperature_levels mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE tl.active = true
),
model_temperature_levels_bounds AS (
    SELECT 
        mtl.model_id::uuid as model_id,
        MIN(tl.temperature) FILTER (WHERE tl.is_upper = false)::float as temperature_lower,
        MAX(tl.temperature) FILTER (WHERE tl.is_upper = true)::float as temperature_upper
    FROM model_temperature_levels mtl
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE tl.active = true
    GROUP BY mtl.model_id
),
model_reasoning_levels_data_with_ids AS (
    SELECT 
        mrl.model_id::uuid as model_id,
        rl.id::uuid as reasoning_level_id,
        rl.reasoning_level::text as reasoning_level_value
    FROM model_reasoning_levels mrl
    JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
    WHERE rl.active = true
),
model_voices_data AS (
    SELECT 
        mv.model_id::uuid as model_id,
        v.id::uuid as voice_id,
        v.voice::text as voice_value
    FROM model_voices mv
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE v.active = true
),
models_agg AS (
    SELECT 
        vm.model_id,
        vm.name,
        vm.description,
        vm.active,
        COALESCE(mtb.temperature_lower, 0.0) as temperature_lower,
        COALESCE(mtb.temperature_upper, 1.0) as temperature_upper,
        COALESCE((SELECT array_agg(mmod2.modality::text ORDER BY mmod2.modality) FROM model_modalities_data mmod2 WHERE mmod2.model_id = vm.model_id AND mmod2.is_input = true), ARRAY[]::text[]) as input_modalities,
        COALESCE((SELECT array_agg(mmod3.modality::text ORDER BY mmod3.modality) FROM model_modalities_data mmod3 WHERE mmod3.model_id = vm.model_id AND mmod3.is_input = false), ARRAY[]::text[]) as output_modalities,
        COALESCE(
            jsonb_object_agg(
                mtl.temperature_level_id::text,
                jsonb_build_object('temperature', mtl.temperature_value, 'is_upper', mtl.is_upper)
            ) FILTER (WHERE mtl.temperature_level_id IS NOT NULL),
            '{}'::jsonb
        ) as temperature_levels,
        COALESCE(
            jsonb_object_agg(
                mrl.reasoning_level_id::text,
                jsonb_build_object('reasoning_level', mrl.reasoning_level_value)
            ) FILTER (WHERE mrl.reasoning_level_id IS NOT NULL),
            '{}'::jsonb
        ) as reasoning_options,
        COALESCE(
            jsonb_object_agg(
                mv.voice_id::text,
                jsonb_build_object('voice', mv.voice_value)
            ) FILTER (WHERE mv.voice_id IS NOT NULL),
            '{}'::jsonb
        ) as available_voices
    FROM valid_models vm
    LEFT JOIN model_temperature_levels_bounds mtb ON mtb.model_id = vm.model_id
    LEFT JOIN model_temperature_levels_data_with_ids mtl ON mtl.model_id = vm.model_id
    LEFT JOIN model_reasoning_levels_data_with_ids mrl ON mrl.model_id = vm.model_id
    LEFT JOIN model_voices_data mv ON mv.model_id = vm.model_id
    GROUP BY vm.model_id, vm.name, vm.description, vm.active, mtb.temperature_lower, mtb.temperature_upper
),
-- Prompts data (all available prompts for agent)
agent_all_prompts AS (
    -- Get all prompts from agent_prompts
    SELECT 
        ap.agent_id::uuid as agent_id,
        ap.prompt_id::uuid as prompt_id,
        pr.system_prompt,
        pr.name as prompt_name,
        pr.description as prompt_description,
        pr.created_at as prompt_created_at,
        pr.updated_at as prompt_updated_at,
        COALESCE(pr.generated, false) as generated
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id
    JOIN prompts_resource pr ON pr.id = ap.prompt_id
    WHERE x.agent_id IS NOT NULL
),
default_prompt_count AS (
    -- Count default prompts (from agent_prompts, not department-specific)
    -- Always return at least one row with count (0 if no prompts)
    SELECT COALESCE(COUNT(DISTINCT ap.prompt_id), 0)::integer as count
    FROM params x
    JOIN agent_prompts ap ON ap.agent_id = x.agent_id
    WHERE x.agent_id IS NOT NULL
),
prompt_mapping_data AS (
    SELECT 
        ap.agent_id::uuid as agent_id,
        ap.prompt_id::uuid as prompt_id,
        ap.system_prompt::text as system_prompt,
        COALESCE(ap.prompt_name, '')::text as prompt_name,
        COALESCE(ap.prompt_description, '')::text as prompt_description,
        ap.prompt_created_at::timestamptz as prompt_created_at,
        ap.prompt_updated_at::timestamptz as prompt_updated_at,
        ARRAY[]::uuid[] as department_ids,
        COALESCE(ap.generated, false) as generated,
        CASE
            -- Prompts can be deleted if there's more than one
            WHEN COALESCE(dpc.count, 0) > 1 THEN true::boolean
            -- Otherwise cannot delete (only one prompt)
            ELSE false::boolean
        END as can_delete
    FROM params x
    LEFT JOIN agent_all_prompts ap ON ap.agent_id = x.agent_id
    CROSS JOIN default_prompt_count dpc
    WHERE x.agent_id IS NOT NULL
      AND ap.prompt_id IS NOT NULL
      AND (
        ap.prompt_id = (SELECT prompt_id FROM prompt_resource_data)
        OR x.prompts_search IS NULL
        OR x.prompts_search = ''
        OR LOWER(COALESCE(ap.prompt_name, '')) LIKE '%' || LOWER(x.prompts_search) || '%'
        OR LOWER(COALESCE(ap.prompt_description, '')) LIKE '%' || LOWER(x.prompts_search) || '%'
        OR LOWER(COALESCE(ap.system_prompt, '')) LIKE '%' || LOWER(x.prompts_search) || '%'
      )
),
-- Always return at least one row for prompt_mapping_data (for CROSS JOIN safety)
prompt_mapping_data_safe AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(
                ROW(pmd.prompt_id, pmd.system_prompt, pmd.prompt_name, pmd.prompt_description, pmd.prompt_created_at, pmd.prompt_updated_at, pmd.department_ids, pmd.can_delete, pmd.generated)::types.q_get_agent_v4_prompt
                ORDER BY pmd.prompt_created_at
            ) FROM prompt_mapping_data pmd),
            ARRAY[]::types.q_get_agent_v4_prompt[]
        ) as prompts_array
    FROM params
    LIMIT 1
),
-- Agent selection helper CTEs (shared across all agent selections)
agent_department_for_agents AS (
    SELECT ad.department_id
    FROM params p
    JOIN agent_departments ad ON ad.agent_id = p.agent_id AND ad.active = true
    WHERE p.agent_id IS NOT NULL
    LIMIT 1
),
profile_primary_department_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.is_primary = TRUE AND pd.active = true
    WHERE p.agent_id IS NULL
    LIMIT 1
),
selected_department_for_agents AS (
    SELECT 
        COALESCE(
            (SELECT department_id FROM agent_department_for_agents),
            (SELECT department_id FROM profile_primary_department_for_agents)
        ) as department_id
),
user_departments_for_agents AS (
    SELECT pd.department_id
    FROM params p
    JOIN profile_departments pd ON pd.profile_id = p.profile_id AND pd.active = true
),
agent_artifact_tool_counts AS (
    SELECT 
        a.id as agent_id,
        COUNT(DISTINCT CASE WHEN ar.resource IS NOT NULL THEN rt.resource::text END) as matched_artifact_count,
        COUNT(DISTINCT CASE WHEN ar.resource IS NULL THEN rt.resource::text END) as extra_outside_count
    FROM agent_artifact a
    LEFT JOIN agent_tools at ON at.agent_id = a.id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (
        SELECT 1 FROM tool_flags tf
        JOIN flags_resource f ON tf.flag_id = f.id
        WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true
    )
    LEFT JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN artifact_resources ar ON ar.resource = rt.resource AND ar.artifact = 'agent'::artifacts
    GROUP BY a.id
),

-- Agent selection for 'names' resource
name_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'names'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'descriptions' resource
description_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'descriptions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'models' resource
models_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'models'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'prompts' resource
prompts_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'prompts'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'instructions' resource
instructions_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'instructions'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'departments' resource
departments_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'departments'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'reasoning_levels' resource
reasoning_levels_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'reasoning_levels'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'temperature_levels' resource
temperature_levels_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'temperature_levels'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'voices' resource
voices_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'voices'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Agent selection for 'tools' resource (tools are selected manually, not generated, so returns NULL)
tools_agent_data AS (
    SELECT NULL::uuid as agent_id
    FROM params
    LIMIT 1
),
-- Agent selection for 'flags' resource
flag_agent_data AS (
    WITH eligible_agents AS (
        SELECT DISTINCT a.id as agent_id, a.updated_at
        FROM agent_artifact a
        CROSS JOIN params p
        CROSS JOIN selected_department_for_agents sd
        WHERE EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'active' 
              AND af.value = true
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN resource_tools rt ON rt.tool_id = at.tool_id
            JOIN artifact_resources ar ON ar.resource = rt.resource
            WHERE at.agent_id = a.id
              AND at.active = TRUE
              AND ar.artifact = 'agent'::artifacts
        )
        AND (
            EXISTS (
                SELECT 1 FROM agent_departments ad
                JOIN user_departments_for_agents ud ON ad.department_id = ud.department_id
                WHERE ad.agent_id = a.id AND ad.active = true
            )
            OR NOT EXISTS (
                SELECT 1 FROM agent_departments ad2 
                WHERE ad2.agent_id = a.id AND ad2.active = true
            )
        )
        AND EXISTS (
            SELECT 1 FROM agent_tools at
            JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND f.name = 'active' AND tf.value = true)
            JOIN resource_tools rt ON rt.tool_id = t.id
            WHERE at.agent_id = a.id AND at.active = true
              AND rt.resource = 'flags'::resources
        )
        -- Filter by MCP flag when mcp=true
        AND (
            (SELECT mcp FROM params) = false
            OR EXISTS (
                SELECT 1 FROM agent_flags af_mcp
                JOIN flags_resource f_mcp ON af_mcp.flag_id = f_mcp.id
                WHERE af_mcp.agent_id = a.id
                  AND f_mcp.name = 'mcp'
                  AND af_mcp.value = true
            )
        )
    ),
    agent_department_preference AS (
        SELECT 
            ea.agent_id,
            CASE 
                WHEN sd.department_id IS NOT NULL 
                     AND EXISTS (
                         SELECT 1 FROM agent_departments ad
                         WHERE ad.agent_id = ea.agent_id 
                           AND ad.department_id = sd.department_id 
                           AND ad.active = true
                     )
                THEN 0
                ELSE 1
            END as dept_preference,
            ea.updated_at,
            COALESCE(atc.matched_artifact_count, 0) as matched_artifact_count,
            COALESCE(atc.extra_outside_count, 0) as extra_outside_count
        FROM eligible_agents ea
        CROSS JOIN selected_department_for_agents sd
        LEFT JOIN agent_artifact_tool_counts atc ON atc.agent_id = ea.agent_id
    )
    SELECT adp.agent_id
    FROM agent_department_preference adp
    ORDER BY 
        CASE 
            WHEN adp.matched_artifact_count = 1 AND adp.extra_outside_count = 0 THEN 0
            ELSE 1
        END ASC,
        adp.matched_artifact_count DESC,
        adp.extra_outside_count ASC,
        adp.dept_preference ASC,
        adp.updated_at DESC,
        adp.agent_id ASC
    LIMIT 1
),
-- Reasoning level resource data (for detail mode and draft mode)
reasoning_level_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT arl.reasoning_level_id FROM agent_reasoning_levels arl WHERE arl.agent_id = (SELECT agent_id FROM params) AND arl.active = true LIMIT 1),
            NULL
        ) as reasoning_level_id,
        (SELECT ROW(rl.id, rl.reasoning_level, COALESCE(rl.generated, false))::types.q_get_agent_v4_reasoning_level_resource FROM agent_reasoning_levels arl JOIN reasoning_levels_resource rl ON arl.reasoning_level_id = rl.id WHERE arl.agent_id = (SELECT agent_id FROM params) AND arl.active = true LIMIT 1) as agent_reasoning_level_resource
    FROM params
),
-- Temperature level resource data (for detail mode and draft mode)
temperature_level_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT atl.temperature_level_id FROM agent_temperature_levels atl WHERE atl.agent_id = (SELECT agent_id FROM params) AND atl.active = true LIMIT 1),
            NULL
        ) as temperature_level_id,
        (SELECT ROW(tl.id, tl.temperature, tl.is_upper, COALESCE(tl.generated, false))::types.q_get_agent_v4_temperature_level_resource FROM agent_temperature_levels atl JOIN temperature_levels_resource tl ON atl.temperature_level_id = tl.id WHERE atl.agent_id = (SELECT agent_id FROM params) AND atl.active = true LIMIT 1) as agent_temperature_level_resource
    FROM params
),
-- Voice resource data (for detail mode and draft mode)
voice_resource_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(av.voice_id ORDER BY av.created_at) FROM agent_voices av WHERE av.agent_id = (SELECT agent_id FROM params) AND av.active = true),
            ARRAY[]::uuid[]
        )::uuid[] as voice_ids,
        COALESCE(
            (SELECT ARRAY_AGG(ROW(v.id, v.voice, COALESCE(v.generated, false))::types.q_get_agent_v4_voice_resource ORDER BY v.voice) FROM agent_voices av JOIN voices_resource v ON av.voice_id = v.id WHERE av.agent_id = (SELECT agent_id FROM params) AND av.active = true),
            ARRAY[]::types.q_get_agent_v4_voice_resource[]
        )::types.q_get_agent_v4_voice_resource[] as agent_voice_resources
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Reasoning level suggestions: linked to agents OR same group with generated=true
reasoning_level_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(arl.reasoning_level_id ORDER BY arl.created_at DESC)
             FROM (
                 SELECT DISTINCT arl.reasoning_level_id, MAX(arl.created_at) as created_at
                 FROM agent_reasoning_levels arl
                 JOIN reasoning_levels_resource rl ON rl.id = arl.reasoning_level_id
                 CROSS JOIN draft_group_data dgd
                 WHERE arl.reasoning_level_id IS NOT NULL
                   AND rl.reasoning_level IS NOT NULL
                   AND rl.reasoning_level != ''
                   AND rl.active = true
                   AND (
                       -- Option 1: Linked to agents (agent_reasoning_levels junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       arl.generated = false
                       OR
                       (
                           arl.generated = true
                           AND rl.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = rl.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY arl.reasoning_level_id
                 ORDER BY MAX(arl.created_at) DESC
                 LIMIT 20
             ) arl),
            ARRAY[]::uuid[]
        ) as reasoning_level_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Temperature level suggestions: linked to agents OR same group with generated=true
temperature_level_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(atl.temperature_level_id ORDER BY atl.created_at DESC)
             FROM (
                 SELECT DISTINCT atl.temperature_level_id, MAX(atl.created_at) as created_at
                 FROM agent_temperature_levels atl
                 JOIN temperature_levels_resource tl ON tl.id = atl.temperature_level_id
                 CROSS JOIN draft_group_data dgd
                 WHERE atl.temperature_level_id IS NOT NULL
                   AND tl.temperature IS NOT NULL
                   AND tl.active = true
                   AND (
                       -- Option 1: Linked to agents (agent_temperature_levels junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       atl.generated = false
                       OR
                       (
                           atl.generated = true
                           AND tl.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = tl.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY atl.temperature_level_id
                 ORDER BY MAX(atl.created_at) DESC
                 LIMIT 20
             ) atl),
            ARRAY[]::uuid[]
        ) as temperature_level_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Voice suggestions: linked to agents OR same group with generated=true
voice_suggestions_data AS (
    SELECT 
        COALESCE(
            (SELECT ARRAY_AGG(av.voice_id ORDER BY av.created_at DESC)
             FROM (
                 SELECT DISTINCT av.voice_id, MAX(av.created_at) as created_at
                 FROM agent_voices av
                 JOIN voices_resource v ON v.id = av.voice_id
                 CROSS JOIN draft_group_data dgd
                 WHERE av.voice_id IS NOT NULL
                   AND v.voice IS NOT NULL
                   AND v.voice != ''
                   AND v.active = true
                   AND (
                       -- Option 1: Linked to agents (agent_voices junction table means it's validated/used)
                       -- Option 2: OR linked to same group with generated=true (show generated items from current group)
                       av.generated = false
                       OR
                       (
                           av.generated = true
                           AND v.generated = true
                           AND EXISTS (
                               SELECT 1 FROM calls c
                               JOIN message_runs mr ON mr.message_id = c.message_id
                               JOIN group_runs gr ON gr.run_id = mr.run_id
                               WHERE c.id = v.call_id
                                 AND gr.group_id = dgd.group_id
                           )
                       )
                   )
                 GROUP BY av.voice_id
                 ORDER BY MAX(av.created_at) DESC
                 LIMIT 20
             ) av),
            ARRAY[]::uuid[]
        ) as voice_suggestions
    FROM params
    -- Always return at least one row
    LIMIT 1
),
-- Reasoning levels data: from selected model's reasoning_options (model-dependent resource)
-- Note: Options come from model_reasoning_levels junction table, filtered by selected model
-- In new mode (no model selected), return empty array - frontend will populate when model is selected
reasoning_levels_data AS (
    SELECT DISTINCT
        rl.id,
        rl.reasoning_level,
        COALESCE(mrl.generated, false) as generated
    FROM params p
    JOIN agent_info ai_selected ON ai_selected.agent_id = (SELECT agent_id FROM params)
    JOIN model_reasoning_levels mrl ON mrl.model_id = ai_selected.model_id
    JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id
    WHERE 
        rl.active = true
        AND rl.reasoning_level IS NOT NULL
        AND rl.reasoning_level != ''
        AND ai_selected.model_id IS NOT NULL
    ORDER BY rl.reasoning_level
),
-- Temperature levels data: from selected model's temperature_levels (model-dependent resource)
-- Note: Options come from model_temperature_levels junction table, filtered by selected model
-- In new mode (no model selected), return empty array - frontend will populate when model is selected
temperature_levels_data AS (
    SELECT DISTINCT
        tl.id,
        tl.temperature,
        tl.is_upper,
        COALESCE(mtl.generated, false) as generated
    FROM params p
    JOIN agent_info ai_selected ON ai_selected.agent_id = (SELECT agent_id FROM params)
    JOIN model_temperature_levels mtl ON mtl.model_id = ai_selected.model_id
    JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id
    WHERE 
        tl.active = true
        AND tl.temperature IS NOT NULL
        AND ai_selected.model_id IS NOT NULL
    ORDER BY tl.temperature, tl.is_upper
),
-- Voices data: from selected model's available_voices (model-dependent resource)
-- Note: Options come from model_voices junction table, filtered by selected model
-- In new mode (no model selected), return empty array - frontend will populate when model is selected
voices_data AS (
    SELECT DISTINCT
        v.id,
        v.voice,
        COALESCE(mv.generated, false) as generated
    FROM params p
    JOIN agent_info ai_selected ON ai_selected.agent_id = (SELECT agent_id FROM params)
    JOIN model_voices mv ON mv.model_id = ai_selected.model_id
    JOIN voices_resource v ON v.id = mv.voice_id
    WHERE 
        v.active = true
        AND v.voice IS NOT NULL
        AND v.voice != ''
        AND ai_selected.model_id IS NOT NULL
    ORDER BY v.voice
),
-- Suggested resource objects CTEs - fetch full resource objects for suggestions
-- For reasoning_levels, temperature_levels, and voices: return all options from selected model (model-dependent resources)
reasoning_levels_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (rld.id, rld.reasoning_level, rld.generated)::types.q_get_agent_v4_reasoning_level_resource
                    ORDER BY rld.reasoning_level
                )
                FROM reasoning_levels_data rld
            ),
            ARRAY[]::types.q_get_agent_v4_reasoning_level_resource[]
        ) as reasoning_levels
    FROM params
    -- Always return at least one row, even if no options exist
    LIMIT 1
),
temperature_levels_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (tld.id, tld.temperature, tld.is_upper, tld.generated)::types.q_get_agent_v4_temperature_level_resource
                    ORDER BY tld.temperature, tld.is_upper
                )
                FROM temperature_levels_data tld
            ),
            ARRAY[]::types.q_get_agent_v4_temperature_level_resource[]
        ) as temperature_levels
    FROM params
    -- Always return at least one row, even if no options exist
    LIMIT 1
),
voices_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (vd.id, vd.voice, vd.generated)::types.q_get_agent_v4_voice_resource
                    ORDER BY vd.voice
                )
                FROM voices_data vd
            ),
            ARRAY[]::types.q_get_agent_v4_voice_resource[]
        ) as voices
    FROM params
    -- Always return at least one row, even if no options exist
    LIMIT 1
),
tools_suggestions_objects AS (
    SELECT 
        COALESCE(
            (
                SELECT ARRAY_AGG(
                    (td.tool_id, td.name, td.description, COALESCE(td.generated, false), COALESCE(td.group_id, NULL))::types.q_get_agent_v4_tool
                    ORDER BY array_position(tsd.tool_suggestions, td.tool_id)
                )
                FROM tool_suggestions_data tsd
                CROSS JOIN LATERAL unnest(tsd.tool_suggestions) AS suggestion_id
                JOIN tools_data td ON td.tool_id = suggestion_id
                WHERE td.name IS NOT NULL AND td.name != ''
            ),
            ARRAY[]::types.q_get_agent_v4_tool[]
        ) as tools
    FROM params
    -- Always return at least one row, even if no suggestions exist
    LIMIT 1
),
-- Valid model IDs CTE (ensure always returns uuid[])
valid_model_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT array_agg(ma2.model_id ORDER BY ma2.name) FROM models_agg ma2),
            ARRAY[]::uuid[]
        )::uuid[] as valid_model_ids
    FROM params
    CROSS JOIN (SELECT 1) dummy
    LIMIT 1
),
-- Valid department IDs CTE (ensure always returns uuid[])
valid_department_ids_data AS (
    SELECT 
        COALESCE(
            (SELECT array_agg(dmd2.department_id ORDER BY dmd2.name) FROM department_mapping_data dmd2),
            ARRAY[]::uuid[]
        )::uuid[] as valid_department_ids
    FROM params
    CROSS JOIN (SELECT 1) dummy
    LIMIT 1
),
-- Agent-specific data (temperature_level_id, reasoning_level_id, voice_ids)
agent_selected_temperature AS (
    SELECT 
        atl.agent_id::uuid as agent_id,
        atl.temperature_level_id::uuid as selected_temperature_level_id
    FROM params x
    JOIN agent_temperature_levels atl ON atl.agent_id = x.agent_id AND atl.active = true
    JOIN temperature_levels_resource tl ON tl.id = atl.temperature_level_id AND tl.active = true
    WHERE x.agent_id IS NOT NULL
    LIMIT 1
),
agent_selected_reasoning AS (
    SELECT 
        arl.agent_id::uuid as agent_id,
        arl.reasoning_level_id::uuid as selected_reasoning_level_id
    FROM params x
    JOIN agent_reasoning_levels arl ON arl.agent_id = x.agent_id AND arl.active = true
    JOIN reasoning_levels_resource rl ON rl.id = arl.reasoning_level_id AND rl.active = true
    WHERE x.agent_id IS NOT NULL
    LIMIT 1
),
agent_selected_voices AS (
    SELECT 
        av.agent_id::uuid as agent_id,
        ARRAY_AGG(v.id::uuid ORDER BY v.voice) as selected_voice_ids
    FROM params x
    JOIN agent_voices av ON av.agent_id = x.agent_id AND av.active = true
    JOIN voices_resource v ON v.id = av.voice_id AND v.active = true
    WHERE x.agent_id IS NOT NULL
    GROUP BY av.agent_id
),
-- Debug info (for detail mode)
debug_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(
                jsonb_build_object(
                    'created_at', di.created_at::text,
                    'model_id', mrm.model_id::text,
                    'content', di.content
                )
                ORDER BY di.created_at DESC
            ),
            ARRAY[]::jsonb[]
        ) as debug_info
    FROM params x
    LEFT JOIN runs mr ON mr.agent_id = x.agent_id
    LEFT JOIN run_debug_info rdi ON rdi.run_id = mr.id
    LEFT JOIN debug_info_resource di ON di.id = rdi.debug_info_id
    LEFT JOIN run_models mrm ON mrm.run_id = mr.id AND mrm.active = true
    WHERE x.agent_id IS NOT NULL
    LIMIT 1
)
SELECT 
    -- Required fields (first 5)
    up.actor_name::text as actor_name,
    aec.agent_exists::boolean as agent_exists,
    perm_final.can_edit::boolean as can_edit,
    perm_final.disabled_reason::text as disabled_reason,
    (SELECT draft_version FROM draft_version_data) as draft_version,
    dgd.group_id::uuid as group_id,
    -- Single-select resources: name
    COALESCE(nrd.name_id, NULL)::uuid as name_id,
    COALESCE(nrd.agent_name_resource, nrd.draft_name_resource, NULL)::types.q_get_agent_v4_name_resource as name_resource,
    CASE 
        WHEN NOT tec.names_has_tools THEN false
        ELSE uf.show_name
    END as show_name,
    (SELECT agent_id FROM name_agent_data)::uuid as name_agent_id,
    true::boolean as name_required,
    COALESCE(nsd.name_suggestions, ARRAY[]::uuid[]) as name_suggestions,
    COALESCE(nso.names, ARRAY[]::types.q_get_agent_v4_name_resource[]) as names,
    -- Single-select resources: description
    COALESCE(drd.description_id, NULL)::uuid as description_id,
    COALESCE(drd.agent_description_resource, drd.draft_description_resource, NULL)::types.q_get_agent_v4_description_resource as description_resource,
    CASE 
        WHEN NOT tec.descriptions_has_tools THEN false
        ELSE uf.show_description
    END as show_description,
    (SELECT agent_id FROM description_agent_data)::uuid as description_agent_id,
    false::boolean as description_required,
    COALESCE(dsd.description_suggestions, ARRAY[]::uuid[]) as description_suggestions,
    COALESCE(dso.descriptions, ARRAY[]::types.q_get_agent_v4_description_resource[]) as descriptions,
    -- Single-select resources: model
    COALESCE(ai.model_id, NULL)::uuid as model_id,
    COALESCE(mrd.model_resource, NULL)::types.q_get_agent_v4_model_resource as model_resource,
    CASE 
        WHEN NOT tec.models_has_tools THEN false
        ELSE uf.show_models
    END as show_models,
    (SELECT agent_id FROM models_agent_data)::uuid as models_agent_id,
    true::boolean as models_required,
    ARRAY[]::uuid[] as model_suggestions,  -- Models don't have suggestions (they're selected from valid models)
    COALESCE(
        (SELECT ARRAY_AGG(
            (ma.model_id, ma.name, ma.description, ma.active, ma.temperature_lower, ma.temperature_upper, ma.input_modalities, ma.output_modalities, ma.temperature_levels, ma.reasoning_options, ma.available_voices)::types.q_get_agent_v4_model
            ORDER BY ma.name
        ) FROM models_agg ma),
        ARRAY[]::types.q_get_agent_v4_model[]
    ) as models,
    -- Single-select resources: prompt
    COALESCE(aap.prompt_id, NULL)::uuid as prompt_id,
    COALESCE(prd.prompt_resource, NULL)::types.q_get_agent_v4_prompt_resource as prompt_resource,
    CASE 
        WHEN NOT tec.prompts_has_tools THEN false
        ELSE uf.show_prompts
    END as show_prompts,
    (SELECT agent_id FROM prompts_agent_data)::uuid as prompts_agent_id,
    false::boolean as prompts_required,
    ARRAY[]::uuid[] as prompt_suggestions,  -- Prompts don't have suggestions (they're agent-specific)
    COALESCE((SELECT prompts_array FROM prompt_mapping_data_safe LIMIT 1), ARRAY[]::types.q_get_agent_v4_prompt[]) as prompts,
    -- Single-select resources: instructions
    COALESCE(instrd.instructions_id, NULL)::uuid as instructions_id,
    COALESCE(instrd.agent_instructions_resource, instrd.draft_instructions_resource, NULL)::types.q_get_agent_v4_instructions_resource as instructions_resource,
    CASE 
        WHEN NOT tec.instructions_has_tools THEN false
        ELSE uf.show_instructions
    END as show_instructions,
    (SELECT agent_id FROM instructions_agent_data)::uuid as instructions_agent_id,
    false::boolean as instructions_required,
    COALESCE(isd.instructions_suggestions, ARRAY[]::uuid[]) as instructions_suggestions,
    COALESCE(iso.instructions, ARRAY[]::types.q_get_agent_v4_instructions_resource[]) as instructions,
    -- Single-select resources: flag
    COALESCE(frd.active_flag_id, NULL)::uuid as active_flag_id,
    COALESCE(frd.agent_flag_resource, frd.draft_flag_resource, NULL)::types.q_get_agent_v4_flag_resource as flag_resource,
    uf.show_flag::boolean as show_flag,
    (SELECT agent_id FROM flag_agent_data)::uuid as flag_agent_id,
    false::boolean as flag_required,
    -- Multi-select resources: departments
    COALESCE(
        CASE 
            WHEN (SELECT agent_id FROM params) IS NULL THEN
                -- New mode: use active departments
                add_active.department_ids
            ELSE
                -- Detail mode: use agent departments
                add_agent.department_ids
        END,
        ARRAY[]::uuid[]
    ) as department_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_agent_v4_department
            ORDER BY dmd.name
        ) FROM department_mapping_data dmd WHERE dmd.department_id = ANY(
            COALESCE(
                CASE 
                    WHEN (SELECT agent_id FROM params) IS NULL THEN
                        add_active.department_ids
                    ELSE
                        add_agent.department_ids
                END,
                ARRAY[]::uuid[]
            )
        )),
        '{}'::types.q_get_agent_v4_department[]
    ) as department_resources,
    CASE 
        WHEN NOT tec.departments_has_tools AND uf.show_departments THEN false
        WHEN EXISTS (SELECT 1 FROM department_mapping_data LIMIT 1) THEN true
        ELSE uf.show_departments
    END as show_departments,
    (SELECT agent_id FROM departments_agent_data)::uuid as departments_agent_id,
    CASE 
        WHEN uf.show_departments THEN true
        ELSE false
    END as departments_required,
    COALESCE(dsd_dept.department_suggestions, ARRAY[]::uuid[]) as department_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (dmd.department_id, dmd.name, dmd.description, dmd.generated)::types.q_get_agent_v4_department
            ORDER BY dmd.name
        ) FROM (SELECT DISTINCT department_id, name, description, generated FROM department_mapping_data) dmd),
        '{}'::types.q_get_agent_v4_department[]
    ) as departments,
    -- Single-select resources: reasoning_levels
    COALESCE(rlrd.reasoning_level_id, NULL)::uuid as reasoning_level_id,
    COALESCE(rlrd.agent_reasoning_level_resource, NULL)::types.q_get_agent_v4_reasoning_level_resource as reasoning_level_resource,
    CASE 
        WHEN NOT tec.reasoning_levels_has_tools THEN false
        ELSE uf.show_reasoning_levels
    END as show_reasoning_levels,
    (SELECT agent_id FROM reasoning_levels_agent_data)::uuid as reasoning_levels_agent_id,
    false::boolean as reasoning_levels_required,
    COALESCE(rlsd.reasoning_level_suggestions, ARRAY[]::uuid[]) as reasoning_level_suggestions,
    -- Reasoning levels array: all available options from selected model (model-dependent)
    -- Use suggestions objects CTE for consistency, but in practice this will be populated from model
    COALESCE(rlso.reasoning_levels, ARRAY[]::types.q_get_agent_v4_reasoning_level_resource[]) as reasoning_levels,
    -- Single-select resources: temperature_levels
    COALESCE(tlrd.temperature_level_id, NULL)::uuid as temperature_level_id,
    COALESCE(tlrd.agent_temperature_level_resource, NULL)::types.q_get_agent_v4_temperature_level_resource as temperature_level_resource,
    CASE 
        WHEN NOT tec.temperature_levels_has_tools THEN false
        ELSE uf.show_temperature_levels
    END as show_temperature_levels,
    (SELECT agent_id FROM temperature_levels_agent_data)::uuid as temperature_levels_agent_id,
    false::boolean as temperature_levels_required,
    COALESCE(tlsd.temperature_level_suggestions, ARRAY[]::uuid[]) as temperature_level_suggestions,
    -- Temperature levels array: all available options from selected model (model-dependent)
    -- Use suggestions objects CTE for consistency, but in practice this will be populated from model
    COALESCE(tlso.temperature_levels, ARRAY[]::types.q_get_agent_v4_temperature_level_resource[]) as temperature_levels,
    -- Multi-select resources: voices
    COALESCE(vrd.voice_ids, ARRAY[]::uuid[])::uuid[] as voice_ids,
    COALESCE(vrd.agent_voice_resources, ARRAY[]::types.q_get_agent_v4_voice_resource[])::types.q_get_agent_v4_voice_resource[] as voice_resources,
    CASE 
        WHEN NOT tec.voices_has_tools THEN false
        ELSE uf.show_voices
    END as show_voices,
    (SELECT agent_id FROM voices_agent_data)::uuid as voices_agent_id,
    false::boolean as voices_required,
    COALESCE(vsd.voice_suggestions, ARRAY[]::uuid[]) as voice_suggestions,
    -- Voices array: all available options from selected model (model-dependent)
    -- Use suggestions objects CTE for consistency, but in practice this will be populated from model
    COALESCE(vso.voices, ARRAY[]::types.q_get_agent_v4_voice_resource[]) as voices,
    -- Multi-select resources: tools
    COALESCE(tid.tool_ids, ARRAY[]::uuid[])::uuid[] as tool_ids,
    COALESCE(
        (SELECT ARRAY_AGG(
            (tmd.tool_id, tmd.name, tmd.description, COALESCE(tmd.generated, false), COALESCE(tmd.group_id, NULL))::types.q_get_agent_v4_tool
            ORDER BY tmd.name
        ) FROM tool_mapping_data tmd WHERE tmd.tool_id = ANY(COALESCE(tid.tool_ids, ARRAY[]::uuid[]))),
        ARRAY[]::types.q_get_agent_v4_tool[]
    ) as tool_resources,
    CASE 
        WHEN NOT tec.tools_has_tools THEN false
        ELSE CASE 
            WHEN (SELECT COUNT(*) FROM tools_data) > 0 THEN true
            ELSE false
        END
    END as show_tools,
    (SELECT agent_id FROM tools_agent_data)::uuid as tools_agent_id,
    false::boolean as tools_required,
    COALESCE(tsd.tool_suggestions, ARRAY[]::uuid[]) as tool_suggestions,
    COALESCE(
        (SELECT ARRAY_AGG(
            (td.tool_id, td.name, td.description, COALESCE(td.generated, false), COALESCE(td.group_id, NULL))::types.q_get_agent_v4_tool
            ORDER BY td.name
        ) FROM tools_data td),
        ARRAY[]::types.q_get_agent_v4_tool[]
    ) as tools
FROM user_profile up
CROSS JOIN agent_exists_check aec
CROSS JOIN permissions_final perm_final
CROSS JOIN ui_flags uf
CROSS JOIN tools_existence_check tec
CROSS JOIN draft_group_data dgd
CROSS JOIN draft_version_data dvd
CROSS JOIN name_resource_data nrd
CROSS JOIN description_resource_data drd
CROSS JOIN instructions_resource_data instrd
CROSS JOIN flag_resource_data frd
CROSS JOIN name_suggestions_data nsd
CROSS JOIN description_suggestions_data dsd
CROSS JOIN instructions_suggestions_data isd
CROSS JOIN department_suggestions_data dsd_dept
CROSS JOIN names_suggestions_objects nso
CROSS JOIN descriptions_suggestions_objects dso
CROSS JOIN instructions_suggestions_objects iso
CROSS JOIN reasoning_level_resource_data rlrd
CROSS JOIN temperature_level_resource_data tlrd
CROSS JOIN voice_resource_data vrd
CROSS JOIN reasoning_level_suggestions_data rlsd
CROSS JOIN temperature_level_suggestions_data tlsd
CROSS JOIN voice_suggestions_data vsd
CROSS JOIN reasoning_levels_suggestions_objects rlso
CROSS JOIN temperature_levels_suggestions_objects tlso
CROSS JOIN voices_suggestions_objects vso
CROSS JOIN tool_ids_data tid
CROSS JOIN tool_suggestions_data tsd
CROSS JOIN tools_suggestions_objects tso
LEFT JOIN agent_info ai ON ai.agent_id = (SELECT agent_id FROM params)
LEFT JOIN agent_active_prompt aap ON aap.agent_id = ai.agent_id
LEFT JOIN agent_departments_data add_agent ON add_agent.agent_id = ai.agent_id
LEFT JOIN active_departments_data add_active ON true
LEFT JOIN model_resource_data mrd ON mrd.model_id = ai.model_id
LEFT JOIN prompt_resource_data prd ON prd.prompt_id = aap.prompt_id
LEFT JOIN agent_selected_temperature ast ON ast.agent_id = ai.agent_id
LEFT JOIN agent_selected_reasoning asr ON asr.agent_id = ai.agent_id
LEFT JOIN agent_selected_voices asv ON asv.agent_id = ai.agent_id
LEFT JOIN models_agg ma ON true
LEFT JOIN prompt_mapping_data_safe pmds ON true
LEFT JOIN department_mapping_data dmd ON true
$$;
