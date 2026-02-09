-- Prepare test run: creates runs_entry, returns conversation and config
-- Call after get_test_run_context validates prerequisites

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_test_run_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_test_run_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_test_run_v4(
    p_profile_id uuid,
    p_chat_id uuid,
    p_run_resource_id uuid
)
RETURNS TABLE (
    -- New run
    run_id uuid,
    group_id uuid,
    trace_id text,
    created_at timestamptz,

    -- Config from group
    system_prompt text,
    model_name text,
    api_key text,
    base_url text,
    temperature float,
    reasoning text,
    provider_name text,

    -- Tools
    tools jsonb,

    -- Developer instructions
    developer_instruction_templates text[],
    jinja_context jsonb,

    -- Original conversation to replay
    original_conversation jsonb,

    -- Run counts
    current_run integer,
    total_runs integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_run_id uuid;
    v_group_id uuid;
    v_trace_id text;
    v_agent_id uuid;
    v_config_id uuid;
    v_created_at timestamptz;
BEGIN
    -- Get group_id directly from benchmark_chats_entry
    SELECT c.group_id INTO v_group_id
    FROM benchmark_chats_entry c
    WHERE c.id = p_chat_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No group binding found for chat %', p_chat_id;
    END IF;

    -- Get agent_id from latest run's config in this group
    SELECT aaj.agent_id INTO v_agent_id
    FROM runs_entry r
    JOIN config_agents_connection cac ON cac.config_id = r.config_id AND cac.active = true
    JOIN agent_agents_junction aaj ON aaj.agents_id = cac.agents_id AND aaj.active = true
    WHERE r.group_id = v_group_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    -- Generate trace_id
    v_trace_id := 'test_' || p_chat_id::text || '_' || p_run_resource_id::text;

    -- Create fresh config_entry for this test run
    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active)
    VALUES (NOW(), NOW(), true, false, true)
    RETURNING id INTO v_config_id;

    -- Snapshot agent config into config
    IF v_agent_id IS NOT NULL THEN
        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        SELECT v_config_id, aaj.agents_id, NOW(), true, false, false
        FROM agent_agents_junction aaj WHERE aaj.agent_id = v_agent_id AND aaj.active = true
        ON CONFLICT (config_id, agents_id) DO NOTHING;
    END IF;

    -- Create new runs_entry with config_id
    INSERT INTO runs_entry (group_id, config_id, generated, mcp, created_at, updated_at)
    VALUES (v_group_id, v_config_id, true, false, NOW(), NOW())
    RETURNING id, created_at INTO v_run_id, v_created_at;

    -- Link profile to run
    INSERT INTO profile_runs_junction (profile_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Return all the data
    RETURN QUERY
    WITH group_config AS (
        SELECT
            g.id as group_id,
            g.trace_id as group_trace_id
        FROM groups_entry g
        WHERE g.id = v_group_id
    ),
    prompt_data AS (
        SELECT
            pr.system_prompt
        FROM config_prompts_connection cpc
        JOIN prompts_resource pr ON pr.id = cpc.prompts_id
        WHERE cpc.config_id = v_config_id AND cpc.active = true
        LIMIT 1
    ),
    model_config AS (
        SELECT
            (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
            COALESCE(e.base_url, '') as base_url
        FROM config_models_connection cmc
        JOIN models_resource m ON m.id = cmc.models_id
        LEFT JOIN model_endpoints_junction mej ON mej.model_id = m.id
        LEFT JOIN endpoints_resource e ON e.id = mej.endpoint_id AND e.active = true
        WHERE cmc.config_id = v_config_id AND cmc.active = true
        LIMIT 1
    ),
    provider_config AS (
        SELECT
            (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as provider_name
        FROM config_providers_connection cpc_prov
        JOIN providers_resource prov ON prov.id = cpc_prov.providers_id
        JOIN provider_providers_junction ppj ON ppj.providers_id = prov.id
        JOIN provider_artifact pr ON pr.id = ppj.provider_id
        WHERE cpc_prov.config_id = v_config_id AND cpc_prov.active = true
        LIMIT 1
    ),
    key_config AS (
        SELECT
            k.key as api_key
        FROM config_keys_connection ckc
        JOIN keys_resource k ON k.id = ckc.keys_id AND k.active = true
        WHERE ckc.config_id = v_config_id AND ckc.active = true
        LIMIT 1
    ),
    temp_config AS (
        SELECT
            tl.temperature
        FROM config_temperature_levels_connection ctlc
        JOIN temperature_levels_resource tl ON tl.id = ctlc.temperature_levels_id AND tl.active = true
        WHERE ctlc.config_id = v_config_id AND ctlc.active = true
        LIMIT 1
    ),
    reasoning_config AS (
        SELECT
            rl.reasoning_level as reasoning
        FROM config_reasoning_levels_connection crlc
        JOIN reasoning_levels_resource rl ON rl.id = crlc.reasoning_levels_id AND rl.active = true
        WHERE crlc.config_id = v_config_id AND crlc.active = true
        LIMIT 1
    ),
    tool_config AS (
        SELECT
            COALESCE(jsonb_agg(jsonb_build_object(
                'name', (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1),
                'description', (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1),
                'parameters', '{}'::jsonb
            )), '[]'::jsonb) as tools
        FROM config_tools_connection ctc
        JOIN tools_resource tr ON tr.id = ctc.tools_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        WHERE ctc.config_id = v_config_id AND ctc.active = true
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    ),
    instruction_config AS (
        SELECT
            COALESCE(ARRAY_AGG(i.template ORDER BY i.created_at), ARRAY[]::text[]) as templates
        FROM config_instructions_connection cic
        JOIN instructions_resource i ON i.id = cic.instructions_id AND i.active = true
        WHERE cic.config_id = v_config_id AND cic.active = true
    ),
    -- Get original conversation from the run_resource
    -- This needs to find the runs_entry linked to runs_resource and get its messages
    original_run AS (
        SELECT
            rrc.run_id as runs_entry_id
        FROM runs_runs_connection rrc
        WHERE rrc.runs_id = p_run_resource_id AND rrc.active = true
        LIMIT 1
    ),
    original_messages AS (
        SELECT
            COALESCE(jsonb_agg(
                jsonb_build_object(
                    'role', m.role::text,
                    'content', COALESCE(t.content, ''),
                    'created_at', m.created_at
                )
                ORDER BY m.created_at
            ), '[]'::jsonb) as conversation
        FROM original_run orr
        JOIN messages_entry m ON m.run_id = orr.runs_entry_id
        LEFT JOIN texts_entry t ON t.id = m.text_id
        WHERE m.active = true
    ),
    run_counts AS (
        SELECT
            COUNT(*)::integer as total_runs,
            (
                SELECT COUNT(*)::integer
                FROM benchmark_chats_runs_connection bcrc
                WHERE bcrc.chat_id = p_chat_id
                  AND bcrc.active = true
                  AND bcrc.created_at < (
                      SELECT bcrc2.created_at
                      FROM benchmark_chats_runs_connection bcrc2
                      WHERE bcrc2.chat_id = p_chat_id
                        AND bcrc2.runs_id = p_run_resource_id
                  )
            ) + 1 as current_run
        FROM benchmark_chats_runs_connection bcrc
        WHERE bcrc.chat_id = p_chat_id AND bcrc.active = true
    )
    SELECT
        v_run_id,
        v_group_id,
        v_trace_id,
        v_created_at,

        COALESCE(pd.system_prompt, ''),
        COALESCE(mc.model_name, ''),
        COALESCE(kc.api_key, ''),
        COALESCE(mc.base_url, ''),
        COALESCE(tc.temperature, 0.0),
        COALESCE(rc.reasoning, ''),
        COALESCE(pc.provider_name, ''),

        COALESCE(tlc.tools, '[]'::jsonb),

        COALESCE(ic.templates, ARRAY[]::text[]),
        '{}'::jsonb,

        COALESCE(om.conversation, '[]'::jsonb),

        COALESCE(rnc.current_run, 1),
        COALESCE(rnc.total_runs, 1)

    FROM (SELECT 1) AS dummy
    LEFT JOIN prompt_data pd ON true
    LEFT JOIN model_config mc ON true
    LEFT JOIN provider_config pc ON true
    LEFT JOIN key_config kc ON true
    LEFT JOIN temp_config tc ON true
    LEFT JOIN reasoning_config rc ON true
    LEFT JOIN tool_config tlc ON true
    LEFT JOIN instruction_config ic ON true
    LEFT JOIN original_messages om ON true
    LEFT JOIN run_counts rnc ON true;
END;
$$;
