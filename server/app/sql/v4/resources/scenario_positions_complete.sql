-- Create scenario_positions resource
-- Get or create operation (returns existing ID if simulation_id + scenario_id already exists)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), simulation_id (uuid, required, third), scenario_id (uuid, required, fourth), value (integer, required, fifth), mcp (boolean, optional, sixth)
-- Returns: id (uuid) - composite key represented as single id for API compatibility
-- Note: scenario_positions is a junction table, so we insert directly into it

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_scenario_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenario_positions_v4(agent_id uuid,
    group_id uuid,
    simulation_id uuid,
    scenario_id uuid,
    value integer,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
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
    v_resource_id uuid;
BEGIN
    -- Validate that simulation exists
    IF NOT EXISTS (SELECT 1 FROM simulation_artifact WHERE id = api_create_scenario_positions_v4.simulation_id) THEN
        RAISE EXCEPTION 'Simulation % does not exist', api_create_scenario_positions_v4.simulation_id;
    END IF;
    
    -- Validate that scenario exists
    IF NOT EXISTS (SELECT 1 FROM scenario_artifact WHERE id = api_create_scenario_positions_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_positions_v4.scenario_id;
    END IF;
    
    -- Validate that simulation_scenarios junction exists (scenario must be linked to simulation first)
    IF NOT EXISTS (
        SELECT 1 FROM simulation_scenarios 
        WHERE simulation_id = api_create_scenario_positions_v4.simulation_id 
          AND scenario_id = api_create_scenario_positions_v4.scenario_id
    ) THEN
        RAISE EXCEPTION 'Scenario % must be linked to simulation % before setting position', 
            api_create_scenario_positions_v4.scenario_id, 
            api_create_scenario_positions_v4.simulation_id;
    END IF;
    
    -- Lookup tool_id from agent_tools + resource_tools_relation
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_scenario_positions_v4.agent_id
      AND rt.resource = 'scenario_positions'::resources
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource scenario_positions', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags 
            WHERE agent_id = api_create_scenario_positions_v4.agent_id 
               
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;

    -- Check if scenario_positions already exists (match on simulation_id + scenario_id)
    SELECT r.id INTO v_resource_id
    FROM scenario_positions_resource r
    WHERE r.simulation_id = api_create_scenario_positions_v4.simulation_id
      AND r.scenario_id = api_create_scenario_positions_v4.scenario_id
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
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
        'scenario_positions_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT or UPDATE INTO scenario_positions_resource
    -- Use ON CONFLICT to update if position already exists for this scenario/value pair
    INSERT INTO scenario_positions_resource (
        scenario_id, 
        value, 
        generated, 
        mcp, 
        call_id, 
        created_at, 
        updated_at
    )
    VALUES (
        api_create_scenario_positions_v4.scenario_id,
        api_create_scenario_positions_v4.value,
        true,
        mcp,
        v_call_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (scenario_id, value) 
    DO UPDATE SET 
        value = EXCLUDED.value,
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
        api_create_scenario_positions_v4.group_id,
        v_run_id,
        COALESCE(MAX(gr.idx), -1) + 1,
        NOW(),
        NOW()
    FROM group_runs gr
    WHERE gr.group_id = api_create_scenario_positions_v4.group_id;
    
    -- Return composite ID (for API compatibility)
    RETURN QUERY SELECT v_resource_id;
END;
$$;
