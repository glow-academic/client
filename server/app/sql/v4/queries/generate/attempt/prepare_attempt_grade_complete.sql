-- Prepare attempt grade - creates grade entry and run for grading
-- Returns context needed for grading including rubric and message history

-- 1) Drop function first
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_attempt_grade_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_attempt_grade_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Create composite type for tools if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type
        WHERE typname = 'i_attempt_grade_tool_v4'
        AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    ) THEN
        CREATE TYPE types.i_attempt_grade_tool_v4 AS (
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
CREATE OR REPLACE FUNCTION socket_prepare_attempt_grade_v4(
    p_profile_id uuid,
    p_attempt_id uuid,
    p_chat_id uuid DEFAULT NULL,
    p_entry_types text[] DEFAULT NULL
)
RETURNS TABLE (
    run_id uuid,
    group_id uuid,
    grade_id uuid,
    trace_id text,

    -- Model config
    model_name text,
    provider_name text,
    base_url text,
    api_key text,
    temperature float,
    reasoning text,
    system_prompt text,

    -- Tools and context
    tools types.i_attempt_grade_tool_v4[],
    developer_instruction_templates text[],
    jinja_context jsonb
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_run_id uuid;
    v_group_id uuid;
    v_grade_id uuid;
    v_trace_id text;
    v_session_id uuid;
    v_simulation_id uuid;
    v_chat_id uuid;
    v_agent_id uuid;
    v_config_id uuid;
BEGIN
    -- Get simulation_id and first chat from attempt
    SELECT sas.simulations_id, COALESCE(p_chat_id, c.id) INTO v_simulation_id, v_chat_id
    FROM simulation_attempts_simulations_connection sas
    JOIN simulation_chats_entry c ON c.attempt_id = p_attempt_id
    WHERE sas.attempt_id = p_attempt_id AND sas.active = true
    LIMIT 1;

    -- Get group_id directly from simulation_chats_entry
    SELECT sc.group_id INTO v_group_id
    FROM simulation_chats_entry sc
    WHERE sc.id = v_chat_id;

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'No group_id found for chat_id %. Group should be set at training start time.', v_chat_id;
    END IF;

    SELECT trace_id INTO v_trace_id FROM groups_entry WHERE id = v_group_id;

    -- Resolve agent_id from latest run's config
    SELECT aaj.agent_id INTO v_agent_id
    FROM runs_entry r
    JOIN config_agents_connection cac ON cac.config_id = r.config_id AND cac.active = true
    JOIN agent_agents_junction aaj ON aaj.agents_id = cac.agents_id AND aaj.active = true
    WHERE r.group_id = v_group_id
    ORDER BY r.created_at DESC
    LIMIT 1;

    -- Create fresh config_entry for this grading run
    INSERT INTO config_entry (created_at, updated_at, generated, mcp, active)
    VALUES (NOW(), NOW(), false, false, true)
    RETURNING id INTO v_config_id;

    -- Snapshot agent config into config
    IF v_agent_id IS NOT NULL THEN
        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        SELECT v_config_id, aaj.agents_id, NOW(), true, false, false
        FROM agent_agents_junction aaj WHERE aaj.agent_id = v_agent_id AND aaj.active = true
        ON CONFLICT (config_id, agents_id) DO NOTHING;
    END IF;

    -- Create run with config_id
    INSERT INTO runs_entry (input_tokens, output_tokens, group_id, config_id)
    VALUES (0, 0, v_group_id, v_config_id)
    RETURNING id INTO v_run_id;

    -- Link run to profile
    INSERT INTO profile_runs_junction (profile_id, run_id)
    VALUES (p_profile_id, v_run_id);

    -- Create grade entry (grade has chat_id directly)
    INSERT INTO simulation_grades_entry (chat_id, run_id, created_at, updated_at, score, passed)
    VALUES (v_chat_id, v_run_id, NOW(), NOW(), 0, false)
    RETURNING id INTO v_grade_id;

    -- Return all data
    RETURN QUERY
    WITH agent_config AS (
        SELECT
            (SELECT pr.system_prompt FROM agent_prompts_junction ap JOIN prompts_resource pr ON ap.prompt_id = pr.id WHERE ap.agent_id = v_agent_id AND ap.active = true LIMIT 1) as system_prompt,
            (SELECT ar.temperature FROM agent_agents_junction aaj JOIN agents_resource ar ON ar.id = aaj.agents_id WHERE aaj.agent_id = v_agent_id AND aaj.active = true LIMIT 1) as temperature,
            (SELECT ar.reasoning FROM agent_agents_junction aaj JOIN agents_resource ar ON ar.id = aaj.agents_id WHERE aaj.agent_id = v_agent_id AND aaj.active = true LIMIT 1) as reasoning
    ),
    model_config AS (
        SELECT
            m.value as model_name,
            m.id as model_id,
            (SELECT n.name FROM provider_providers_junction ppj JOIN provider_names_junction pn ON pn.provider_id = ppj.provider_id JOIN names_resource n ON pn.name_id = n.id WHERE ppj.providers_id = pr.id LIMIT 1) as provider_name,
            COALESCE(pr.endpoint, '') as base_url,
            pr.key as api_key
        FROM agent_agents_junction aaj
        JOIN agents_resource ar ON ar.id = aaj.agents_id
        JOIN models_resource m ON m.id = ar.model_id
        LEFT JOIN providers_resource pr ON pr.id = m.provider_id
        WHERE aaj.agent_id = v_agent_id AND aaj.active = true
        LIMIT 1
    ),
    tools_data AS (
        SELECT ARRAY_AGG(
            (t.id,
             (SELECT n.name FROM tool_names_junction tn JOIN names_resource n ON tn.name_id = n.id WHERE tn.tool_id = t.id LIMIT 1),
             COALESCE((SELECT d.description FROM tool_descriptions_junction td JOIN descriptions_resource d ON td.description_id = d.id WHERE td.tool_id = t.id LIMIT 1), ''),
             COALESCE(br.entry::text, ''),
             '',
             '{}'::jsonb,
             '{}'::jsonb,
             '{}'::jsonb,
             true
            )::types.i_attempt_grade_tool_v4
        ) as tools
        FROM agent_tools_junction at
        JOIN tools_resource tr ON tr.id = at.tool_id AND at.active = true
        JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
        JOIN tool_artifact t ON t.id = ttj.tool_id
        LEFT JOIN tool_bindings_junction tbj ON tbj.tool_id = t.id AND tbj.active = true
        LEFT JOIN bindings_resource br ON br.id = tbj.binding_id AND br.active = true
        WHERE at.agent_id = v_agent_id
          AND (p_entry_types IS NULL OR br.entry::text = ANY(p_entry_types))
          AND br.id IS NOT NULL
    ),
    developer_instructions AS (
        SELECT ARRAY_AGG(i.template ORDER BY i.created_at) as templates
        FROM agent_instructions_junction ai
        JOIN instructions_resource i ON i.id = ai.instruction_id AND i.active = true
        WHERE ai.agent_id = v_agent_id
    ),
    -- Get all messages from all chats in attempt (or specific chat if provided)
    attempt_messages AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'chat_id', m.chat_id::text,
                'role', m.role::text,
                'content', m.content,
                'created_at', m.created_at
            ) ORDER BY m.created_at
        ) as messages
        FROM simulation_messages_entry m
        JOIN simulation_chats_entry c ON c.id = m.chat_id
        WHERE c.attempt_id = p_attempt_id
          AND m.completed = true
          AND (p_chat_id IS NULL OR m.chat_id = p_chat_id)
    ),
    -- Get rubric for grading
    rubric_data AS (
        SELECT jsonb_build_object(
            'id', r.id::text,
            'name', (SELECT n.name FROM rubric_names_junction rn JOIN names_resource n ON rn.name_id = n.id WHERE rn.rubric_id = r.id LIMIT 1),
            'points', (SELECT pt.points FROM rubric_points_junction rp JOIN points_resource pt ON rp.points_id = pt.id WHERE rp.rubric_id = r.id LIMIT 1),
            'pass_points', (SELECT pt.pass_points FROM rubric_points_junction rp JOIN points_resource pt ON rp.points_id = pt.id WHERE rp.rubric_id = r.id LIMIT 1)
        ) as rubric
        FROM simulation_rubrics_junction sr
        JOIN rubric_artifact r ON r.id = sr.rubric_id
        WHERE sr.simulation_id = v_simulation_id AND sr.active = true
        LIMIT 1
    ),
    jinja_ctx AS (
        SELECT jsonb_build_object(
            'simulation', jsonb_build_object(
                'id', v_simulation_id::text,
                'name', (SELECT n.name FROM simulation_names_junction sn JOIN names_resource n ON sn.name_id = n.id WHERE sn.simulation_id = v_simulation_id LIMIT 1)
            ),
            'attempt', jsonb_build_object(
                'id', p_attempt_id::text
            ),
            'grade', jsonb_build_object(
                'id', v_grade_id::text
            ),
            'chat_id', v_chat_id::text,
            'messages', COALESCE((SELECT messages FROM attempt_messages), '[]'::jsonb),
            'rubric', COALESCE((SELECT rubric FROM rubric_data), '{}'::jsonb)
        ) as context
    )
    SELECT
        v_run_id,
        v_group_id,
        v_grade_id,
        v_trace_id,
        mc.model_name,
        mc.provider_name,
        mc.base_url,
        mc.api_key,
        ac.temperature,
        ac.reasoning,
        ac.system_prompt,
        td.tools,
        di.templates,
        jc.context
    FROM agent_config ac
    LEFT JOIN model_config mc ON TRUE
    LEFT JOIN tools_data td ON TRUE
    LEFT JOIN developer_instructions di ON TRUE
    LEFT JOIN jinja_ctx jc ON TRUE;
END;
$$;
