-- Prepare attempt message - creates user message, assistant placeholder, run
-- Returns all context needed for generation including model config, tools, chat history
-- Groups are pre-created at training start time - this function reads them.

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_attempt_message_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_attempt_message_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for tools if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_attempt_message_tool_v4'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_attempt_message_tool_v4 AS (
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
CREATE OR REPLACE FUNCTION socket_prepare_attempt_message_v4(
    p_profile_id uuid,
    p_chat_id uuid,
    p_message text,
    p_voice_mode boolean DEFAULT false,
    p_upload_id uuid DEFAULT NULL,
    p_group_id uuid DEFAULT NULL,
    p_entry_types text[] DEFAULT NULL
)
RETURNS TABLE (
    -- Message IDs
    user_message_id uuid,
    assistant_message_id uuid,
    run_id uuid,
    group_id uuid,
    trace_id text,
    created_at timestamptz,

    -- Model config
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    temperature real,
    reasoning text,
    system_prompt text,

    -- Voice model config
    voice_model_name text,
    voice_provider text,
    voice_base_url text,
    voice_api_key text,
    voice_temperature real,
    voice_reasoning text,

    -- Tools and context
    tools types.i_attempt_message_tool_v4[],
    developer_instruction_templates text[],
    chat_history jsonb
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_user_message_id uuid;
    v_assistant_message_id uuid;
    v_run_id uuid;
    v_group_id uuid;
    v_trace_id text;
    v_created_at timestamptz;
    v_agent_id uuid;
BEGIN

    -- Read pre-stored group from simulation_chats_bindings_entry
    -- If p_group_id is provided (regeneration), use that directly
    IF p_group_id IS NOT NULL THEN
        SELECT groups_entry.id, groups_entry.trace_id INTO v_group_id, v_trace_id
        FROM groups_entry
        WHERE groups_entry.id = p_group_id;
    END IF;

    IF v_group_id IS NULL THEN
        -- Read group from chat's bindings, filtering by entry_types if provided
        SELECT scbe.group_id INTO v_group_id
        FROM simulation_chats_bindings_entry scbe
        JOIN bindings_entry be ON be.id = scbe.binding_id AND be.active = true
        JOIN bindings_bindings_connection bbc ON bbc.binding_id = be.id AND bbc.active = true
        JOIN bindings_resource br ON br.id = bbc.bindings_id AND br.active = true
        WHERE scbe.chat_id = p_chat_id AND scbe.active = TRUE
          AND (p_entry_types IS NULL OR br.entry::text = ANY(p_entry_types))
        LIMIT 1;

        IF v_group_id IS NOT NULL THEN
            SELECT trace_id INTO v_trace_id FROM groups_entry WHERE id = v_group_id;
        END IF;
    END IF;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No pre-stored group found for chat_id %. Groups should be created at training start time.', p_chat_id;
    END IF;

    -- Resolve agent_id from stored group's agents connection
    SELECT aaj.agent_id INTO v_agent_id
    FROM groups_agents_connection gac
    JOIN agent_agents_junction aaj ON aaj.agents_id = gac.agents_id AND aaj.active = true
    WHERE gac.group_id = v_group_id AND gac.active = true
    LIMIT 1;

    -- Create run
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id)
    VALUES (0, 0, v_group_id)
    RETURNING id INTO v_run_id;

    -- Link run to profile
    INSERT INTO profile_runs_junction (profile_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Link run to agent (if resolved)
    IF v_agent_id IS NOT NULL THEN
        INSERT INTO agent_runs_junction (agent_id, run_id)
        VALUES (v_agent_id, v_run_id);
    END IF;

    v_created_at := NOW();

    -- Create user message in base table first
    INSERT INTO messages_entry (run_id, role, completed, audio, created_at, updated_at)
    VALUES (v_run_id, 'user'::message_type, true, p_voice_mode, v_created_at, v_created_at)
    RETURNING messages_entry.id INTO v_user_message_id;

    -- Link user message to simulation chat
    INSERT INTO simulation_messages_entry (id, chat_id)
    VALUES (v_user_message_id, p_chat_id);

    -- Insert user content (with Student persona)
    INSERT INTO simulation_contents_entry (message_id, content, persona_id)
    VALUES (v_user_message_id, p_message, '019bb25e-e60c-7352-9b81-f411f56092a9'::uuid);

    -- Create assistant message placeholder in base table
    -- Offset by 1ms so ORDER BY created_at is deterministic (user before assistant)
    INSERT INTO messages_entry (run_id, role, completed, audio, created_at, updated_at)
    VALUES (v_run_id, 'assistant'::message_type, false, p_voice_mode, v_created_at + interval '1 millisecond', v_created_at + interval '1 millisecond')
    RETURNING messages_entry.id INTO v_assistant_message_id;

    -- Link assistant message to simulation chat
    INSERT INTO simulation_messages_entry (id, chat_id)
    VALUES (v_assistant_message_id, p_chat_id);

    -- Return all data (using v_agent_id resolved from stored group)
    RETURN QUERY
    WITH agent_config AS (
        SELECT
            (SELECT pr.system_prompt FROM agent_prompts_junction ap JOIN prompts_resource pr ON ap.prompt_id = pr.id WHERE ap.agent_id = v_agent_id AND ap.active = true LIMIT 1) as system_prompt,
            (SELECT tl.temperature FROM agent_temperature_levels_junction atl JOIN temperature_levels_resource tl ON atl.temperature_level_id = tl.id WHERE atl.agent_id = v_agent_id AND atl.active = true LIMIT 1) as temperature,
            (SELECT rl.reasoning_level FROM agent_reasoning_levels_junction arl JOIN reasoning_levels_resource rl ON arl.reasoning_level_id = rl.id WHERE arl.agent_id = v_agent_id AND arl.active = true LIMIT 1) as reasoning
    ),
    model_config AS (
        SELECT
            mr.value as model_name,
            ma.id as model_artifact_id,
            (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id
             JOIN provider_providers_junction ppj ON ppj.provider_id = pn.provider_id
             JOIN providers_resource pr ON pr.id = ppj.providers_id
             JOIN model_providers_junction mp ON mp.providers_id = pr.id
             WHERE mp.model_id = ma.id LIMIT 1) as provider_name,
            (SELECT e.base_url FROM model_endpoints_junction me JOIN endpoints_resource e ON me.endpoint_id = e.id WHERE me.model_id = ma.id AND e.active = true LIMIT 1) as base_url
        FROM agent_models_junction am
        JOIN model_artifact ma ON ma.id = am.model_id
        JOIN model_models_junction mmj ON mmj.model_id = ma.id
        JOIN models_resource mr ON mr.id = mmj.models_id
        WHERE am.agent_id = v_agent_id
        LIMIT 1
    ),
    api_key_data AS (
        SELECT kr.key as api_key
        FROM model_config mc
        JOIN model_providers_junction mp ON mp.model_id = mc.model_artifact_id
        JOIN setting_provider_keys_junction spk ON spk.providers_id = mp.providers_id AND spk.active = true
        JOIN keys_resource kr ON kr.id = spk.key_id AND kr.active = true
        LIMIT 1
    ),
    tool_schema_data AS (
        SELECT
            t.id as tool_id,
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
                                WHEN ar.default_value ~ '^-?[0-9]+\\.?[0-9]*$' THEN to_jsonb(ar.default_value::numeric)
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
                                WHEN ar.default_value ~ '^\\[.*\\]$' THEN ar.default_value::jsonb
                                ELSE NULL
                            END
                        ELSE ar.default_value::jsonb
                    END
                    ORDER BY ar.position
                ) FILTER (WHERE ar.name IS NOT NULL AND ar.default_value != ''),
                '{}'::jsonb
            ) as argument_defaults
        FROM tool_artifact t
        LEFT JOIN tool_args_junction ta ON ta.tool_id = t.id
        LEFT JOIN args_resource ar ON ar.id = ta.args_id AND ar.active = true
        GROUP BY t.id
    ),
    tools_data AS (
        SELECT ARRAY_AGG(
            (t.id,
             (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1),
             COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''),
             COALESCE(br.entry::text, ''),
             '',
             COALESCE(tsd.arguments, '{}'::jsonb),
             COALESCE(tsd.argument_descriptions, '{}'::jsonb),
             COALESCE(tsd.argument_defaults, '{}'::jsonb),
             true
            )::types.i_attempt_message_tool_v4
        ) as tools
        FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id AND at.active = true
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        LEFT JOIN tool_bindings_junction tbj ON tbj.tool_id = t.id AND tbj.active = true
        LEFT JOIN bindings_resource br ON br.id = tbj.binding_id AND br.active = true
        LEFT JOIN tool_schema_data tsd ON tsd.tool_id = t.id
        WHERE at.agent_id = v_agent_id
          AND (p_entry_types IS NULL OR br.entry::text = ANY(p_entry_types))
          AND br.creatable = true
    ),
    developer_instructions AS (
        SELECT ARRAY_AGG(i.template ORDER BY i.created_at) as templates
        FROM agent_instructions_junction ai
        JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
        WHERE ai.agent_id = v_agent_id
    ),
    chat_messages AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'role', me.role::text,
                'content', COALESCE(ce.content, '')
            ) ORDER BY me.created_at
        ) as history
        FROM simulation_messages_entry sm
        JOIN messages_entry me ON me.id = sm.id
        LEFT JOIN simulation_contents_entry ce ON ce.message_id = sm.id
        WHERE sm.chat_id = p_chat_id
          AND me.completed = true
          AND sm.id != v_user_message_id
          AND sm.id != v_assistant_message_id
    )
    SELECT
        v_user_message_id,
        v_assistant_message_id,
        v_run_id,
        v_group_id,
        v_trace_id,
        v_created_at,
        mc.model_name,
        mc.provider_name,
        mc.base_url,
        akd.api_key,
        ac.temperature,
        ac.reasoning,
        ac.system_prompt,
        NULL::text,  -- voice_model_name (TODO)
        NULL::text,  -- voice_provider
        NULL::text,  -- voice_base_url
        NULL::text,  -- voice_api_key
        NULL::real, -- voice_temperature
        NULL::text,  -- voice_reasoning
        td.tools,
        di.templates,
        cm.history
    FROM agent_config ac
    LEFT JOIN model_config mc ON TRUE
    LEFT JOIN api_key_data akd ON TRUE
    LEFT JOIN tools_data td ON TRUE
    LEFT JOIN developer_instructions di ON TRUE
    LEFT JOIN chat_messages cm ON TRUE;
END;
$$;
