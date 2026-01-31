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
#variable_conflict use_column
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
    v_run_id uuid;
    v_resource_id uuid;
BEGIN
    -- Validate that simulation exists (simulation_scenarios_junction references simulation_artifact)
    IF NOT EXISTS (SELECT 1 FROM simulation_artifact WHERE id = api_create_scenario_positions_v4.simulation_id) THEN
        RAISE EXCEPTION 'Simulation % does not exist', api_create_scenario_positions_v4.simulation_id;
    END IF;

    -- Validate that scenario exists (check _resource table, not _artifact, since FK references _resource)
    IF NOT EXISTS (SELECT 1 FROM scenarios_resource WHERE id = api_create_scenario_positions_v4.scenario_id) THEN
        RAISE EXCEPTION 'Scenario % does not exist', api_create_scenario_positions_v4.scenario_id;
    END IF;

    -- Check if scenario_positions already exists (match on scenario_id + value)
    SELECT r.id INTO v_resource_id
    FROM scenario_positions_resource r
    WHERE r.scenario_id = api_create_scenario_positions_v4.scenario_id
      AND r.value = api_create_scenario_positions_v4.value
    LIMIT 1;

    IF v_resource_id IS NOT NULL THEN
        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- When agent_id is NULL, skip tool lookup and insert directly (user-initiated, not agent-generated)
    IF api_create_scenario_positions_v4.agent_id IS NULL THEN
        INSERT INTO scenario_positions_resource (
            scenario_id,
            value,
            generated,
            mcp,
            created_at
        )
        VALUES (
            api_create_scenario_positions_v4.scenario_id,
            api_create_scenario_positions_v4.value,
            false,  -- Not AI-generated when no agent
            mcp,
            NOW()
        )
        RETURNING id INTO v_resource_id;

        RETURN QUERY SELECT v_resource_id;
        RETURN;
    END IF;

    -- Validate that simulation_scenarios_junction junction exists (scenario must be linked to simulation first)
    IF NOT EXISTS (
        SELECT 1 FROM simulation_scenarios_junction
        WHERE simulation_id = api_create_scenario_positions_v4.simulation_id
          AND scenario_id = api_create_scenario_positions_v4.scenario_id
    ) THEN
        RAISE EXCEPTION 'Scenario % must be linked to simulation % before setting position',
            api_create_scenario_positions_v4.scenario_id,
            api_create_scenario_positions_v4.simulation_id;
    END IF;

    -- Lookup tool_id from agent_tools_junction + resource_tools_relation
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools_junction at
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact t ON t.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_scenario_positions_v4.agent_id
      AND rt.resource = 'scenario_positions'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;

    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource scenario_positions', agent_id;
    END IF;

    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction
            WHERE agent_id = api_create_scenario_positions_v4.agent_id
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
    INSERT INTO calls_entry (
        id, external_call_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'scenario_positions_' || v_call_id::text,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- Link tool to call
    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES (v_tool_id, v_call_id);
    
    -- INSERT or UPDATE INTO scenario_positions_resource
    -- Use ON CONFLICT to update if position already exists for this scenario/value pair
    INSERT INTO scenario_positions_resource (
        scenario_id, 
        value, 
        generated, 
        mcp, 
        call_id, 
        created_at
    )
    VALUES (
        api_create_scenario_positions_v4.scenario_id,
        api_create_scenario_positions_v4.value,
        true,
        mcp,
        v_call_id,
        NOW()
    )
    ON CONFLICT (scenario_id, value) 
    DO UPDATE SET 
        value = EXCLUDED.value,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp,
        call_id = EXCLUDED.call_id
    RETURNING id INTO v_resource_id;
    

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, api_create_scenario_positions_v4.group_id, NOW(), NOW());

    -- Link agent to run
    INSERT INTO agent_runs_junction (agent_id, run_id) VALUES (api_create_scenario_positions_v4.agent_id, v_run_id);
    
    -- Link call to run

    
    
    -- Return composite ID (for API compatibility)
    RETURN QUERY SELECT v_resource_id;
END;
$$;
