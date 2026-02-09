-- Prepare persona generation: rate limit check, group/run creation, config snapshot, and full context fetch
-- All business logic in one SQL function - fail fast on rate limit
-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_persona_generation_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_persona_generation_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for tools (reuse existing if available)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_get_text_run_context_and_create_run_v4_tool'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_get_text_run_context_and_create_run_v4_tool AS (
            id uuid,
            name text,
            description text,
            resource text,
            artifact text,
            arguments jsonb,
            argument_descriptions jsonb,
            argument_defaults jsonb,
            active boolean
        );
    END IF;
END $$;

-- 3) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_persona_generation_v4(
    p_profile_id uuid,
    p_agent_id uuid,
    p_group_id uuid DEFAULT NULL,  -- Optional: for regeneration (uses existing group)
    p_resources types.i_persona_resource_v4[] DEFAULT NULL,  -- Optional: array of (resource_type, resource_ids) for Jinja context
    p_current_resources types.i_persona_resource_v4[] DEFAULT NULL,  -- Optional: form state for "current" variable in Jinja templates
    p_resource_types text[] DEFAULT NULL  -- Optional: resource types to filter tools (e.g., ARRAY['names', 'colors'])
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    trace_id text,
    -- Agent context
    agent_name text,
    system_prompt text,
    -- Model context (API key encrypted - Python handler decrypts)
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    temperature float,
    reasoning text,
    voice text,
    quality text,
    -- Tools filtered by resource type
    tools types.i_get_text_run_context_and_create_run_v4_tool[],
    -- Developer instruction templates (raw - Python renders with Jinja)
    developer_instruction_templates text[],
    -- Jinja context (whitelisted fields only)
    jinja_context jsonb,
    -- Output modalities
    output_modalities text[],
    -- Config snapshot ID
    config_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_agent_id uuid;
    v_group_id uuid;
    v_trace_id text;
    v_run_id uuid;
    v_config_id uuid;
    v_settings_id uuid;
    v_session_id uuid;
    -- Context data
    v_agent_name text;
    v_system_prompt text;
    v_model_name text;
    v_provider_name text;
    v_base_url text;
    v_api_key text;
    v_temperature float;
    v_reasoning text;
    v_voice text;
    v_quality text;
    v_tools types.i_get_text_run_context_and_create_run_v4_tool[];
    v_developer_instruction_templates text[];
    v_jinja_context jsonb;
    v_output_modalities text[];
BEGIN
    -- Validate agent exists and is active
    SELECT a.id INTO v_agent_id
    FROM agent_artifact a
    WHERE a.id = p_agent_id
      AND EXISTS (SELECT 1 FROM agent_flags_junction af JOIN flags_resource f ON af.flag_id = f.id WHERE af.agent_id = a.id AND f.name = 'agent_active' AND af.value = true)
    LIMIT 1;

    IF v_agent_id IS NULL THEN
        RETURN;
    END IF;

    -- Get output modalities
    SELECT array_agg(mr.modality::text ORDER BY mr.modality) INTO v_output_modalities
    FROM agent_artifact a
    JOIN agent_models_junction am ON am.agent_id = a.id
    JOIN model_modalities_junction mm ON mm.model_id = am.model_id
    JOIN modalities_resource mr ON mr.id = mm.modality_id
    WHERE a.id = p_agent_id
      AND mm.type = 'output'::direction_type
      AND mm.active = true
      AND mr.active = true;

    -- Get or create group
    IF p_group_id IS NOT NULL THEN
        SELECT g.id, g.trace_id INTO v_group_id, v_trace_id
        FROM view_groups_entry g
        WHERE g.id = p_group_id
        LIMIT 1;
    END IF;

    IF v_group_id IS NULL THEN
        INSERT INTO view_groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = p_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
        RETURNING id, view_groups_entry.trace_id INTO v_group_id, v_trace_id;
    END IF;

    -- Fallback if group creation somehow failed
    IF v_group_id IS NULL THEN
        v_group_id := gen_random_uuid();
        v_trace_id := gen_random_uuid()::text;
    END IF;

    -- Create config_entry (runtime snapshot)
    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active)
    VALUES (NOW(), NOW(), false, false, true)
    RETURNING id INTO v_config_id;

    -- Populate 3 config connection tables from agent config
    -- 1. agents
    INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
    SELECT v_config_id, aaj.agents_id, NOW(), true, false, false
    FROM agent_agents_junction aaj WHERE aaj.agent_id = v_agent_id AND aaj.active = true
    ON CONFLICT (config_id, agents_id) DO NOTHING;

    -- 2. models (via denormalized agents_resource.model_id)
    INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
    SELECT v_config_id, ar.model_id, NOW(), true, false, false
    FROM agent_agents_junction aaj
    JOIN agents_resource ar ON ar.id = aaj.agents_id
    WHERE aaj.agent_id = v_agent_id AND aaj.active = true AND ar.model_id IS NOT NULL
    ON CONFLICT (config_id, models_id) DO NOTHING;

    -- 3. providers (via agents_resource.model_id -> provider_models_junction)
    INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
    SELECT v_config_id, pr.id, NOW(), true, false, false
    FROM agent_agents_junction aaj
    JOIN agents_resource ar ON ar.id = aaj.agents_id
    JOIN provider_models_junction pmj ON pmj.model_id = ar.model_id
    JOIN provider_providers_junction ppj ON ppj.provider_id = pmj.provider_id AND ppj.active = true
    JOIN providers_resource pr ON pr.id = ppj.providers_id
    WHERE aaj.agent_id = v_agent_id AND aaj.active = true
    ON CONFLICT (config_id, providers_id) DO NOTHING;

    -- Create run with group_id and config_id
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id, config_id)
    VALUES (0, 0, v_group_id, v_config_id)
    RETURNING id INTO v_run_id;

    -- Link run to profile
    INSERT INTO profile_runs_junction (profile_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Fetch context data (agent/model config)
    SELECT
        (SELECT n.name FROM agent_names_junction an JOIN names_resource n ON an.name_id = n.id WHERE an.agent_id = a.id LIMIT 1),
        COALESCE(pr_prompt.system_prompt, ''),
        COALESCE(ar.temperature, 0.0),
        ar.reasoning,
        m.value,
        COALESCE(n_prov.name, ''),
        COALESCE(m.endpoint, ''),
        m.key,
        ar.voice,
        ar.quality
    INTO
        v_agent_name,
        v_system_prompt,
        v_temperature,
        v_reasoning,
        v_model_name,
        v_provider_name,
        v_base_url,
        v_api_key,
        v_voice,
        v_quality
    FROM agent_artifact a
    -- Agent prompt
    LEFT JOIN agent_prompts_junction ap_default ON ap_default.agent_id = a.id AND ap_default.active = true
    LEFT JOIN prompts_resource pr_prompt ON pr_prompt.id = ap_default.prompt_id
    -- Model chain (via denormalized agents_resource.model_id)
    INNER JOIN agent_agents_junction aaj ON aaj.agent_id = a.id AND aaj.active = true
    INNER JOIN agents_resource ar ON ar.id = aaj.agents_id
    INNER JOIN models_resource m ON m.id = ar.model_id
    -- Provider (via provider_models_junction)
    LEFT JOIN provider_models_junction pmj ON pmj.model_id = m.id
    LEFT JOIN provider_artifact pr_prov ON pr_prov.id = pmj.provider_id
    LEFT JOIN provider_names_junction pn_prov ON pn_prov.provider_id = pr_prov.id
    LEFT JOIN names_resource n_prov ON n_prov.id = pn_prov.name_id
    WHERE a.id = v_agent_id;

    -- Fetch tools
    SELECT COALESCE(
        ARRAY_AGG(
            (t.id, (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1), COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''), COALESCE(rt.resource::text, ''), COALESCE(NULL::artifact_type::text, ''), COALESCE(tsd.arguments, '{}'::jsonb), COALESCE(tsd.argument_descriptions, '{}'::jsonb), COALESCE(tsd.argument_defaults, '{}'::jsonb), EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true))::types.i_get_text_run_context_and_create_run_v4_tool
            ORDER BY COALESCE(rt.resource::text, ''), (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1)
        ) FILTER (WHERE t.id IS NOT NULL AND (
            p_resource_types IS NULL
            OR rt.resource IS NULL
            OR rt.resource::text = ANY(p_resource_types)
        )),
        '{}'::types.i_get_text_run_context_and_create_run_v4_tool[]
    ) INTO v_tools
    FROM agent_tools_junction atj
    LEFT JOIN tools_resource tr ON tr.id = atj.tool_id
    LEFT JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    LEFT JOIN tool_artifact t ON t.id = ttj.tool_id AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LEFT JOIN (
        SELECT
            tsd_inner.id as tool_id,
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
            COALESCE(
                jsonb_object_agg(
                    ar.name,
                    ar.description
                    ORDER BY ar.position
                ) FILTER (WHERE ar.name IS NOT NULL AND ar.description != ''),
                '{}'::jsonb
            ) as argument_descriptions,
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
        FROM tool_artifact tsd_inner
        LEFT JOIN tool_args_junction ta ON ta.tool_id = tsd_inner.id
        LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
        GROUP BY tsd_inner.id
    ) tsd ON tsd.tool_id = t.id
    LEFT JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE atj.agent_id = v_agent_id AND atj.active = true;

    -- Fetch developer instruction templates
    SELECT COALESCE(
        ARRAY_AGG(i.template ORDER BY i.created_at),
        ARRAY[]::text[]
    ) INTO v_developer_instruction_templates
    FROM agent_instructions_junction ai
    JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
    WHERE ai.agent_id = v_agent_id;

    -- Build Jinja context from resources
    SELECT jsonb_build_object(
        'names', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', n.id::text, 'name', n.name))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS name_id
            JOIN names_resource n ON n.id = name_id
            WHERE r.resource_type = 'names'
        ), '[]'::jsonb),
        'descriptions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', d.id::text, 'description', d.description))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
            JOIN descriptions_resource d ON d.id = desc_id
            WHERE r.resource_type = 'descriptions'
        ), '[]'::jsonb),
        'colors', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', c.id::text, 'name', c.name, 'description', c.description, 'hex_code', c.hex_code))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
            JOIN colors_resource c ON c.id = color_id
            WHERE r.resource_type = 'colors'
        ), '[]'::jsonb),
        'icons', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', i.id::text, 'name', i.name, 'description', i.description, 'value', i.value))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
            JOIN icons_resource i ON i.id = icon_id
            WHERE r.resource_type = 'icons'
        ), '[]'::jsonb),
        'instructions', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', inst.id::text, 'template', inst.template))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
            JOIN instructions_resource inst ON inst.id = inst_id
            WHERE r.resource_type = 'instructions'
        ), '[]'::jsonb),
        'flags', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', f.id::text, 'name', f.name, 'description', f.description))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
            JOIN flags_resource f ON f.id = flag_id
            WHERE r.resource_type = 'flags'
        ), '[]'::jsonb),
        'departments', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', d.id::text,
                'name', (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                'description', (SELECT desc_data.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
            ))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
            JOIN departments_resource d ON d.id = dept_id
            WHERE r.resource_type = 'departments'
        ), '[]'::jsonb),
        'fields', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', ffj.field_id::text,
                'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
                'description', (SELECT desc_data.description FROM field_descriptions_junction fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = ffj.field_id LIMIT 1)
            ))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
            JOIN fields_resource f ON f.id = field_id_val
            JOIN field_fields_junction ffj ON ffj.fields_id = f.id
            WHERE r.resource_type = 'fields'
        ), '[]'::jsonb),
        'parameters', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', pa.id::text,
                'name', (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1),
                'description', (SELECT desc_data.description FROM parameter_descriptions_junction pd JOIN descriptions_resource desc_data ON pd.description_id = desc_data.id WHERE pd.parameter_id = pa.id LIMIT 1)
            ))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS param_id
            JOIN parameter_artifact pa ON pa.id = param_id
            WHERE r.resource_type = 'parameters'
        ), '[]'::jsonb),
        'examples', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', e.id::text, 'example', e.example))
            FROM unnest(COALESCE(p_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
            CROSS JOIN LATERAL unnest(r.resource_ids) AS example_id
            JOIN examples_resource e ON e.id = example_id
            WHERE r.resource_type = 'examples'
        ), '[]'::jsonb),
        -- Current selections (form state from frontend)
        'current', jsonb_build_object(
            'names', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', n.id::text, 'name', n.name))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS name_id
                JOIN names_resource n ON n.id = name_id
                WHERE r.resource_type = 'names'
            ), '[]'::jsonb),
            'descriptions', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', d.id::text, 'description', d.description))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS desc_id
                JOIN descriptions_resource d ON d.id = desc_id
                WHERE r.resource_type = 'descriptions'
            ), '[]'::jsonb),
            'colors', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', c.id::text, 'name', c.name, 'description', c.description, 'hex_code', c.hex_code))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS color_id
                JOIN colors_resource c ON c.id = color_id
                WHERE r.resource_type = 'colors'
            ), '[]'::jsonb),
            'icons', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', i.id::text, 'name', i.name, 'description', i.description, 'value', i.value))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS icon_id
                JOIN icons_resource i ON i.id = icon_id
                WHERE r.resource_type = 'icons'
            ), '[]'::jsonb),
            'instructions', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', inst.id::text, 'template', inst.template))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS inst_id
                JOIN instructions_resource inst ON inst.id = inst_id
                WHERE r.resource_type = 'instructions'
            ), '[]'::jsonb),
            'flags', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', f.id::text, 'name', f.name, 'description', f.description))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS flag_id
                JOIN flags_resource f ON f.id = flag_id
                WHERE r.resource_type = 'flags'
            ), '[]'::jsonb),
            'departments', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', d.id::text,
                    'name', (SELECT n.name FROM department_names_junction dn JOIN names_resource n ON dn.name_id = n.id WHERE dn.department_id = d.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM department_descriptions_junction dd JOIN descriptions_resource desc_data ON dd.description_id = desc_data.id WHERE dd.department_id = d.id LIMIT 1)
                ))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS dept_id
                JOIN departments_resource d ON d.id = dept_id
                WHERE r.resource_type = 'departments'
            ), '[]'::jsonb),
            'parameter_fields', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', ffj.field_id::text,
                    'name', (SELECT n.name FROM field_names_junction fn JOIN names_resource n ON fn.name_id = n.id WHERE fn.field_id = ffj.field_id LIMIT 1),
                    'description', (SELECT desc_data.description FROM field_descriptions_junction fd JOIN descriptions_resource desc_data ON fd.description_id = desc_data.id WHERE fd.field_id = ffj.field_id LIMIT 1)
                ))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS field_id_val
                JOIN fields_resource f ON f.id = field_id_val
                JOIN field_fields_junction ffj ON ffj.fields_id = f.id
                WHERE r.resource_type = 'parameter_fields'
            ), '[]'::jsonb),
            'parameters', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', pa.id::text,
                    'name', (SELECT n.name FROM parameter_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.parameter_id = pa.id LIMIT 1),
                    'description', (SELECT desc_data.description FROM parameter_descriptions_junction pd JOIN descriptions_resource desc_data ON pd.description_id = desc_data.id WHERE pd.parameter_id = pa.id LIMIT 1)
                ))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS param_id
                JOIN parameter_artifact pa ON pa.id = param_id
                WHERE r.resource_type = 'parameters'
            ), '[]'::jsonb),
            'examples', COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', e.id::text, 'example', e.example))
                FROM unnest(COALESCE(p_current_resources, ARRAY[]::types.i_persona_resource_v4[])) AS r
                CROSS JOIN LATERAL unnest(r.resource_ids) AS example_id
                JOIN examples_resource e ON e.id = example_id
                WHERE r.resource_type = 'examples'
            ), '[]'::jsonb)
        )
    ) INTO v_jinja_context;

    -- Return result
    RETURN QUERY SELECT
        v_run_id,
        v_group_id,
        v_trace_id::text,
        v_agent_name,
        v_system_prompt,
        v_model_name,
        v_provider_name,
        v_base_url,
        v_api_key,
        v_temperature,
        v_reasoning,
        v_voice,
        v_quality,
        v_tools,
        v_developer_instruction_templates,
        v_jinja_context,
        COALESCE(v_output_modalities, ARRAY[]::text[]),
        v_config_id;
END;
$$;
