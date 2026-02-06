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
    v_created_at timestamptz;
BEGIN
    -- Get group_id from chat bindings
    SELECT b.group_id INTO v_group_id
    FROM benchmark_chats_bindings_entry b
    WHERE b.chat_id = p_chat_id AND b.active = true
    LIMIT 1;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No group binding found for chat %', p_chat_id;
    END IF;

    -- Get agent_id from group
    SELECT ar.id INTO v_agent_id
    FROM groups_agents_connection gac
    JOIN agents_resource ar ON ar.id = gac.agents_id
    WHERE gac.group_id = v_group_id AND gac.active = true
    LIMIT 1;

    -- Generate trace_id
    v_trace_id := 'test_' || p_chat_id::text || '_' || p_run_resource_id::text;

    -- Create new runs_entry for this replay
    INSERT INTO runs_entry (group_id, generated, mcp, created_at, updated_at)
    VALUES (v_group_id, true, false, NOW(), NOW())
    RETURNING id, created_at INTO v_run_id, v_created_at;

    -- Link profile to run
    INSERT INTO profile_runs_junction (profile_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Link agent to run
    IF v_agent_id IS NOT NULL THEN
        INSERT INTO agent_runs_junction (agent_id, run_id)
        VALUES (v_agent_id, v_run_id);
    END IF;

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
        FROM groups_prompts_connection gpc
        JOIN prompts_resource pr ON pr.id = gpc.prompts_id
        WHERE gpc.group_id = v_group_id AND gpc.active = true
        LIMIT 1
    ),
    model_config AS (
        SELECT
            (SELECT v.value FROM model_values_junction mv JOIN values_resource v ON mv.value_id = v.id WHERE mv.model_id = m.id LIMIT 1) as model_name,
            COALESCE(e.base_url, '') as base_url
        FROM groups_models_connection gmc
        JOIN models_resource m ON m.id = gmc.models_id
        LEFT JOIN model_endpoints_junction mej ON mej.model_id = m.id
        LEFT JOIN endpoints_resource e ON e.id = mej.endpoint_id AND e.active = true
        WHERE gmc.group_id = v_group_id AND gmc.active = true
        LIMIT 1
    ),
    provider_config AS (
        SELECT
            (SELECT n.name FROM provider_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.provider_id = pr.id LIMIT 1) as provider_name
        FROM groups_providers_connection gpc_prov
        JOIN providers_resource prov ON prov.id = gpc_prov.providers_id
        JOIN provider_providers_junction ppj ON ppj.providers_id = prov.id
        JOIN provider_artifact pr ON pr.id = ppj.provider_id
        WHERE gpc_prov.group_id = v_group_id AND gpc_prov.active = true
        LIMIT 1
    ),
    key_config AS (
        SELECT
            k.key as api_key
        FROM groups_keys_connection gkc
        JOIN keys_resource k ON k.id = gkc.keys_id AND k.active = true
        WHERE gkc.group_id = v_group_id AND gkc.active = true
        LIMIT 1
    ),
    temp_config AS (
        SELECT
            tl.temperature
        FROM groups_temperature_levels_connection gtlc
        JOIN temperature_levels_resource tl ON tl.id = gtlc.temperature_level_id AND tl.active = true
        WHERE gtlc.group_id = v_group_id AND gtlc.active = true
        LIMIT 1
    ),
    reasoning_config AS (
        SELECT
            rl.reasoning_level as reasoning
        FROM groups_reasoning_levels_connection grlc
        JOIN reasoning_levels_resource rl ON rl.id = grlc.reasoning_level_id AND rl.active = true
        WHERE grlc.group_id = v_group_id AND grlc.active = true
        LIMIT 1
    ),
    tool_config AS (
        SELECT
            COALESCE(jsonb_agg(jsonb_build_object(
                'name', (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1),
                'description', (SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1),
                'parameters', '{}'::jsonb
            )), '[]'::jsonb) as tools
        FROM groups_tools_connection gtc
        JOIN tools_resource tr ON tr.id = gtc.tools_id
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        WHERE gtc.group_id = v_group_id AND gtc.active = true
          AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    ),
    instruction_config AS (
        SELECT
            COALESCE(ARRAY_AGG(i.template ORDER BY i.created_at), ARRAY[]::text[]) as templates
        FROM groups_instructions_connection gic
        JOIN instructions_resource i ON i.id = gic.instructions_id AND i.active = true
        WHERE gic.group_id = v_group_id AND gic.active = true
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
