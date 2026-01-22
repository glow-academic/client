-- Create scenario_rubrics resource
-- Always INSERT operation (preserves all information)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), scenario_id (uuid, required, third), rubric_id (uuid, required, fourth), mcp (boolean, optional, fifth)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_scenario_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenario_rubrics_v4(agent_id uuid,
    group_id uuid,
    scenario_id uuid,
    rubric_id uuid,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_resource_id uuid;
    v_call_id uuid;
    v_tool_id uuid;
    v_template_id uuid;
    v_arguments_raw text;
    v_schema_id uuid;
    v_arg_key text;
    v_arg_value text;
    v_args_jsonb jsonb := '{}'::jsonb;
    v_params_jsonb jsonb;
    v_message_id uuid;
    v_run_id uuid;
BEGIN
    -- Validate scenario and rubric exist
    IF NOT EXISTS (SELECT 1 FROM scenario_artifact WHERE id = api_create_scenario_rubrics_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_rubrics_v4.scenario_id;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM rubric_artifact WHERE id = api_create_scenario_rubrics_v4.rubric_id) THEN
        RAISE EXCEPTION 'Rubric % does not exist', api_create_scenario_rubrics_v4.rubric_id;
    END IF;
    
    -- Lookup tool_id from agent_tools + resource_tools
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_scenario_rubrics_v4.agent_id
      AND rt.resource = 'scenario_rubrics'::resources
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource scenario_rubrics', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags 
            WHERE agent_id = api_create_scenario_rubrics_v4.agent_id
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Build arguments_raw directly from params (templates removed)
    v_args_jsonb := '{}'::jsonb;
    v_arguments_raw := v_args_jsonb::text;
    
    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'scenario_rubrics_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT INTO scenario_rubrics_resource table (always insert, never update)
    INSERT INTO scenario_rubrics_resource (
        scenario_id,
        rubric_id,
        active,
        generated,
        mcp,
        call_id,
        created_at,
        updated_at
    )
    VALUES (
        api_create_scenario_rubrics_v4.scenario_id,
        api_create_scenario_rubrics_v4.rubric_id,
        true,
        true,
        mcp,
        v_call_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (scenario_id, rubric_id)
    DO UPDATE SET
        active = true,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp,
        call_id = EXCLUDED.call_id,
        updated_at = NOW()
    RETURNING id INTO v_resource_id;
    
    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO messages (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_role, false, false, NOW(), NOW());
    
    -- Link message to call
    UPDATE calls SET message_id = v_message_id WHERE id = v_call_id;
    
    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs (id, agent_id, input_tokens, output_tokens, cached_input_tokens, created_at, updated_at)
    VALUES (v_run_id, agent_id, 0, 0, 0, NOW(), NOW());
    
    -- Link run to message
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    VALUES (v_message_id, v_run_id, NOW(), NOW());
    
    -- Link run to group (calculate idx)
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT 
        api_create_scenario_rubrics_v4.group_id,
        v_run_id,
        COALESCE(MAX(gr.idx), -1) + 1,
        NOW(),
        NOW()
    FROM group_runs gr
    WHERE gr.group_id = api_create_scenario_rubrics_v4.group_id;
    
    RETURN QUERY SELECT v_resource_id;
END;
$$;
