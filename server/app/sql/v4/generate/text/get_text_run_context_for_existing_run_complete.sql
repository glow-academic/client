-- Get all data needed to run text generation agent for existing run
-- Takes run_id and returns full context (agent config, tools, messages_entry, etc.)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate
-- NOTE: The type i_get_text_run_context_and_create_run_v4_tool is already defined in
-- get_text_run_context_and_create_run_complete.sql and reused here
-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
    func_sig text;
BEGIN
    FOR r IN 
        SELECT oid
        FROM pg_proc 
        WHERE proname = 'socket_get_text_run_context_for_existing_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        BEGIN
            -- Try to get signature, but handle missing types gracefully
            SELECT pg_get_function_identity_arguments(r.oid) INTO func_sig;
            EXECUTE format('DROP FUNCTION IF EXISTS socket_get_text_run_context_for_existing_run_v4(%s)', func_sig);
        EXCEPTION WHEN OTHERS THEN
            -- Function might reference missing types, try dropping by OID with CASCADE
            BEGIN
                EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', r.oid::regprocedure);
            EXCEPTION WHEN OTHERS THEN
                NULL; -- Ignore errors if function doesn't exist or can't be dropped
            END;
        END;
    END LOOP;
END $$;

-- 2) Recreate function
-- Takes run_id and returns full context for agent execution
CREATE OR REPLACE FUNCTION socket_get_text_run_context_for_existing_run_v4(
    run_id uuid,
    agent_id uuid,
    message_ids uuid[] DEFAULT NULL,  -- Includes user regeneration message (if created) + context messages_entry
    group_id uuid DEFAULT NULL,
    resources types.i_persona_resource_v4[] DEFAULT NULL  -- Optional: array of (resource_type, resource_ids) for fetching whitelisted resources
)
RETURNS TABLE (
    agent_id text,
    agent_name text,
    agent_role text,
    system_prompt text,
    temperature float,
    reasoning text,
    model_id text,
    model_name text,
    provider text,
    base_url text,
    api_key text,
    profile_id text,
    req_per_day integer,
    runs_today_count bigint,
    earliest_run_created_at timestamptz,
    group_id uuid,
    trace_id text,
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    developer_instruction_templates text[],  -- Changed to array
    context jsonb,  -- Added: whitelisted resources for Jinja templating
    department_name text,
    upload_id uuid,
    file_path text,
    mime_type text
)
LANGUAGE sql
VOLATILE
AS $$
WITH params AS (
    SELECT 
        run_id AS run_id,
        agent_id AS agent_id,
        message_ids AS message_ids,
        group_id AS group_id,
        resources AS resources
),
-- Validate run exists
existing_run AS (
    SELECT
        r.id as run_id,
        r.agent_id,
        gd.group_id,
        gd.trace_id
    FROM runs_entry r
    CROSS JOIN params p
    LEFT JOIN groups_entry g ON g.id = r.group_id
    LEFT JOIN LATERAL (
        SELECT
            COALESCE(r.group_id, p.group_id) as group_id,
            COALESCE(g.trace_id, gen_random_uuid()::text) as trace_id
    ) gd ON true
    WHERE r.id = p.run_id
    LIMIT 1
),
-- Get group_id and trace_id
group_data AS (
    SELECT 
        er.group_id,
        er.trace_id
    FROM existing_run er
),
-- Get agent
selected_agent AS (
    SELECT a.id as agent_id
    FROM agent_artifact a
    CROSS JOIN params p
    WHERE a.id = p.agent_id
      AND EXISTS (SELECT 1 FROM agent_flags af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LIMIT 1
),
-- Get profile FROM runs_entry
run_profile AS (
    SELECT r.profile_id
    FROM runs_entry r
    CROSS JOIN params p
    WHERE r.id = p.run_id
    LIMIT 1
),
-- Get rate limit info (for display, not validation)
profile_rate_limit AS (
    SELECT 
        rl.requests_per_day as req_per_day
    FROM run_profile rp
    LEFT JOIN profile_request_limits prl ON prl.profile_id = rp.profile_id AND prl.active = true
    LEFT JOIN request_limits_resource rl ON prl.request_limit_id = rl.id
),
runs_today AS (
    SELECT
        COUNT(*)::bigint as runs_today_count,
        MIN(mr.created_at) as earliest_run_created_at
    FROM runs_entry mr
    CROSS JOIN run_profile rp
    WHERE mr.profile_id = rp.profile_id
      AND mr.created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
),
-- Get active settings for profile (for key lookup via setting_provider_keys)
profile_primary_department AS (
    SELECT pd.department_id
    FROM run_profile rp
    JOIN profile_departments pd ON pd.profile_id = rp.profile_id
    WHERE pd.is_primary = TRUE 
      AND pd.active = true
    LIMIT 1
),
default_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    WHERE EXISTS (SELECT 1 FROM scenario_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.scenario_id = s.id AND f.name = 'scenario_active' AND sf.value = true)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
dept_specific_settings AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND sd.active = true
    LIMIT 1
),
settings_with_keys AS (
    SELECT DISTINCT spk.settings_id
    FROM setting_provider_keys spk
    JOIN keys_resource kr ON kr.id = spk.key_id
    WHERE spk.active = true AND kr.active
),
dept_specific_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN department_settings sd ON sd.settings_id = s.id
    JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE ppd.department_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE) AND sd.active = true
    LIMIT 1
),
default_settings_with_keys AS (
    SELECT s.id as settings_id
    FROM setting_artifact s
    JOIN settings_with_keys swk ON swk.settings_id = s.id
    WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = s.id AND f.name = 'setting_active' AND sf.value = TRUE)
      AND NOT EXISTS (
          SELECT 1 FROM department_settings sd 
          WHERE sd.settings_id = s.id AND sd.active = true
      )
    LIMIT 1
),
active_settings AS (
    SELECT 
        COALESCE(
            (SELECT settings_id FROM dept_specific_settings_with_keys),
            (SELECT settings_id FROM default_settings_with_keys),
            (SELECT settings_id FROM settings_with_keys LIMIT 1),
            (SELECT settings_id FROM dept_specific_settings),
            (SELECT settings_id FROM default_settings),
            (SELECT id FROM setting_artifact WHERE EXISTS (SELECT 1 FROM setting_flags sf JOIN flags_resource f ON sf.flag_id = f.id WHERE sf.setting_id = setting_artifact.id AND f.name = 'setting_active' AND sf.value = TRUE) LIMIT 1)
        ) as settings_id
),
-- Build tool arguments FROM args_resource (replaces schemas_resource)
tool_schema_data AS (
    SELECT 
        t.id as tool_id,
        ta.args_id as schema_id,  -- Using args_id as schema_id for backward compatibility
        -- Build arguments JSONB FROM args_resource
        COALESCE(
            jsonb_object_agg(
                ar.name,
                jsonb_build_object(
                    'type', CASE ar.field_type
                        WHEN 'string' THEN 'string'
                        WHEN 'number' THEN 'number'
                        WHEN 'boolean' THEN 'boolean'
                        WHEN 'array' THEN 'array'
                        ELSE 'string'
                    END,
                    'required', ar.required
                )
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL),
            '{}'::jsonb
        ) as arguments,
        -- Build argument_descriptions JSONB FROM args_resource.description
        COALESCE(
            jsonb_object_agg(
                ar.name,
                ar.description
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
            '{}'::jsonb
        ) as argument_descriptions,
        -- Build argument_defaults JSONB FROM args_resource.default_value
        COALESCE(
            jsonb_object_agg(
                ar.name,
                CASE 
                    WHEN ar.default_value = '' THEN NULL
                    WHEN ar.field_type = 'number' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^-?[0-9]+\.?[0-9]*$' THEN to_jsonb(ar.default_value::numeric)
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'boolean' THEN 
                        CASE 
                            WHEN LOWER(ar.default_value) IN ('true', '1', 'yes') THEN 'true'::jsonb
                            WHEN LOWER(ar.default_value) IN ('false', '0', 'no') THEN 'false'::jsonb
                            ELSE NULL
                        END
                    WHEN ar.field_type = 'array' THEN 
                        CASE 
                            WHEN ar.default_value ~ '^\[.*\]$' THEN ar.default_value::jsonb
                            ELSE NULL
                        END
                    ELSE ar.default_value::jsonb
                END
                ORDER BY ar.position
            ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
            '{}'::jsonb
        ) as argument_defaults
    FROM tool_artifact t
    LEFT JOIN tool_args ta ON ta.tool_id = t.id
    LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
    GROUP BY t.id, ta.args_id
),
-- Get agent tools as composite type array
-- Filter tools to only include those matching the resource_type parameter
-- Include tools where rt.resource matches resource_type OR rt.resource IS NULL (global tools)
agent_tools_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(
                (t.id, (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(rt.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
                ORDER BY COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
            ) FILTER (WHERE t.id IS NOT NULL AND (
                p.resources IS NULL  -- Backward compatibility: include all tools
                OR rt.resource IS NULL  -- Global tools always included
                OR EXISTS (
                    SELECT 1 FROM unnest(p.resources) AS r
                    WHERE rt.resource::text = r.resource_type
                )
            )),
            '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
        ) as tools
    FROM selected_agent sa
    CROSS JOIN params p
    LEFT JOIN agent_tools at ON at.agent_id = sa.agent_id AND at.active = true
    LEFT JOIN tool_artifact t ON t.id = at.tool_id AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    
    
    GROUP BY sa.agent_id
),
-- Get developer instruction templates (array) for the agent
developer_instruction_data AS (
    SELECT 
        sa.agent_id,
        COALESCE(
            ARRAY_AGG(i.template ORDER BY i.created_at),
            ARRAY[]::text[]
        ) as developer_instruction_templates
    FROM selected_agent sa
    INNER JOIN agents_resource a ON a.id = sa.agent_id
    LEFT JOIN agent_instructions ai ON ai.agent_id = a.id
    LEFT JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
    GROUP BY sa.agent_id
),
-- Fetch whitelisted resources based on resource_ids (if provided)
-- Reuse the same pattern as get_text_run_context_and_create_run
names_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', n.id::text,
                    'name', n.name
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS name_id
    JOIN names_resource n ON n.id = name_id
    WHERE r.resource_type = 'names'
),
descriptions_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'description', d.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
    JOIN descriptions_resource d ON d.id = desc_id
    WHERE r.resource_type = 'descriptions'
),
colors_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', c.id::text,
                    'name', c.name,
                    'description', c.description,
                    'hex_code', c.hex_code
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
    JOIN colors_resource c ON c.id = color_id
    WHERE r.resource_type = 'colors'
),
icons_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', i.id::text,
                    'name', i.name,
                    'description', i.description,
                    'value', i.value
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
    JOIN icons_resource i ON i.id = icon_id
    WHERE r.resource_type = 'icons'
),
instructions_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', inst.id::text,
                    'template', inst.template
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
    JOIN instructions_resource inst ON inst.id = inst_id
    WHERE r.resource_type = 'instructions'
),
flags_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.id::text,
                    'name', f.name,
                    'description', f.description
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
    JOIN flags_resource f ON f.id = flag_id
    WHERE r.resource_type = 'flags'
),
departments_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', d.id::text,
                    'name', (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM department_descriptions dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
    JOIN departments_resource d ON d.id = dept_id
    WHERE r.resource_type = 'departments'
),
fields_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', f.field_id::text,
                    'name', (SELECT n.name FROM field_names fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = f.field_id LIMIT 1),
                    'description', (SELECT desc_data.description FROM field_descriptions fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = f.field_id LIMIT 1)
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
    JOIN fields_resource f ON f.id = field_id_val
    WHERE r.resource_type = 'fields'
),
examples_resources AS (
    SELECT 
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', e.id::text,
                    'example', e.example
                )
            ),
            '[]'::jsonb
        ) as resources
    FROM params p
    CROSS JOIN LATERAL unnest(COALESCE(p.resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
    CROSS JOIN LATERAL unnest(r.resource_ids) AS example_id
    JOIN examples_resource e ON e.id = example_id
    WHERE r.resource_type = 'examples'
),
-- Combine all resources into single JSONB object
combined_resources AS (
    SELECT 
        jsonb_build_object(
            'names', COALESCE((SELECT resources FROM names_resources), '[]'::jsonb),
            'descriptions', COALESCE((SELECT resources FROM descriptions_resources), '[]'::jsonb),
            'colors', COALESCE((SELECT resources FROM colors_resources), '[]'::jsonb),
            'icons', COALESCE((SELECT resources FROM icons_resources), '[]'::jsonb),
            'instructions', COALESCE((SELECT resources FROM instructions_resources), '[]'::jsonb),
            'flags', COALESCE((SELECT resources FROM flags_resources), '[]'::jsonb),
            'departments', COALESCE((SELECT resources FROM departments_resources), '[]'::jsonb),
            'fields', COALESCE((SELECT resources FROM fields_resources), '[]'::jsonb),
            'examples', COALESCE((SELECT resources FROM examples_resources), '[]'::jsonb)
        ) as context
),
-- Get department name (from agent_departments or profile primary department)
department_data AS (
    SELECT 
        COALESCE(
            (SELECT ad.department_id FROM agent_departments ad 
             JOIN selected_agent sa ON NULL::uuid = sa.agent_id 
             WHERE ad.active = true LIMIT 1),
            (SELECT ppd.department_id FROM profile_primary_department ppd)
        ) as department_id
),
department_name_data AS (
    SELECT (SELECT n.name FROM department_names dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1) as department_name
    FROM department_data dd
    LEFT JOIN departments_resource d ON d.id = dd.department_id
),
-- Get upload info if exists (for audio input) - get FROM messages_entry linked to run
upload_info AS (
    SELECT DISTINCT
        u.id as upload_id,
        u.file_path,
        u.mime_type
    FROM params p
    JOIN messages_entry m ON m.run_id = p.run_id
    JOIN calls_entry c_audio ON c_audio.message_id = m.id
    JOIN audios_resource ar ON ar.call_id = c_audio.id AND ar.active = true
    JOIN uploads_entry u ON u.id = ar.upload_id
    LIMIT 1
),
-- Context data with agent config
context_data AS (
    SELECT 
        -- Agent data
        a.id::text as agent_id,
        (SELECT n.name FROM agent_names an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1) as agent_name,
        COALESCE(NULL::artifact_type::text, '') as agent_role,  -- Derive from domain_artifacts via agent_domains
        COALESCE(pr_prompt.system_prompt, '') as system_prompt,  -- Don't append developer instructions here - Python will handle it
        COALESCE(tl.temperature, 0.0) as temperature,
        rl.reasoning_level as reasoning,
        
        -- Model data
        m.id::text as model_id,
        (SELECT v.value FROM model_values mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
        COALESCE(n_prov.name, '') as provider,
        COALESCE(e.base_url, '') as base_url,
        kr.key as api_key,
        
        -- Profile data
        rp.profile_id::text as profile_id,
        
        -- Rate limit data (for display)
        prl.req_per_day,
        COALESCE(rt.runs_today_count, 0::bigint) as runs_today_count,
        rt.earliest_run_created_at,
        
        -- Tools data
        COALESCE(atd.tools, '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]) as tools,
        
        -- Developer instruction templates (array)
        COALESCE(did.developer_instruction_templates, ARRAY[]::text[]) as developer_instruction_templates,
        
        -- Context (whitelisted resources for Jinja templating)
        COALESCE(cr.context, '{}'::jsonb) as context,
        
        -- Department data
        dnd.department_name

    FROM selected_agent sa
    INNER JOIN agents_resource a ON a.id = sa.agent_id
    
    
    CROSS JOIN run_profile rp
    -- Try department-specific prompt first, fall back to default prompt
    LEFT JOIN agent_departments ad ON ad.agent_id = a.id AND ad.active = true
    LEFT JOIN agent_prompts ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id
    INNER JOIN agent_models am ON am.agent_id = a.id
    INNER JOIN models_resource m ON m.id = am.model_id
    -- Join temperature from junction table
    LEFT JOIN agent_temperature_levels atl ON atl.agent_id = a.id AND atl.active = true
    LEFT JOIN model_temperature_levels mtl ON mtl.temperature_level_id = atl.temperature_level_id AND mtl.model_id = m.id 
    LEFT JOIN temperature_levels_resource tl ON tl.id = mtl.temperature_level_id AND tl.active = true
    -- Join reasoning from junction table
    LEFT JOIN agent_reasoning_levels arl ON arl.agent_id = a.id AND arl.active = true
    LEFT JOIN model_reasoning_levels mrl ON mrl.reasoning_level_id = arl.reasoning_level_id AND mrl.model_id = m.id 
    LEFT JOIN reasoning_levels_resource rl ON rl.id = mrl.reasoning_level_id AND rl.active = true
    LEFT JOIN model_endpoints me_j ON me_j.model_id = m.id
    LEFT JOIN endpoints_resource e ON e.id = me_j.endpoint_id AND e.active = true
    -- Get keys via settings system: provider -> active settings -> setting_provider_keys
    LEFT JOIN model_providers mp ON mp.model_id = m.id
    LEFT JOIN providers_resource p_prov ON p_prov.id = mp.providers_id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = p_prov.provider_id
    LEFT JOIN provider_names pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    CROSS JOIN active_settings act_s
    LEFT JOIN setting_provider_keys spk ON spk.providers_id = p_prov.id 
        AND spk.settings_id = act_s.settings_id 
        AND spk.active = true
    LEFT JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active
    CROSS JOIN profile_rate_limit prl
    CROSS JOIN runs_today rt
    -- JOIN tools_resource data
    LEFT JOIN agent_tools_data atd ON atd.agent_id = sa.agent_id
    -- Join developer instruction data
    LEFT JOIN developer_instruction_data did ON did.agent_id = sa.agent_id
    -- Join context (whitelisted resources)
    CROSS JOIN combined_resources cr
    -- JOIN department_artifact data
    CROSS JOIN department_name_data dnd
)
SELECT 
    -- Context data
    cd.agent_id,
    cd.agent_name,
    cd.agent_role,
    cd.system_prompt,
    cd.temperature,
    cd.reasoning,
    cd.model_id,
    cd.model_name,
    cd.provider,
    cd.base_url,
    cd.api_key,
    cd.profile_id,
    cd.req_per_day,
    cd.runs_today_count,
    cd.earliest_run_created_at,
    -- Group ID and trace_id (from groups_entry table)
    gd.group_id,
    gd.trace_id::text as trace_id,
    -- Tools array
    cd.tools,
    -- Developer instruction templates (array)
    cd.developer_instruction_templates,
    -- Context (whitelisted resources for Jinja templating)
    cd.context,
    -- Department name
    cd.department_name,
    -- Upload info (for audio input, when upload_id is provided)
    ui.upload_id,
    ui.file_path,
    ui.mime_type
FROM context_data cd
CROSS JOIN existing_run er
CROSS JOIN group_data gd
LEFT JOIN upload_info ui ON true
$$;

