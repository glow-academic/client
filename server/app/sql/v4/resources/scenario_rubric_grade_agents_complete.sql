-- Create scenario_rubric_grade_agents resource
-- Always INSERT operation (preserves all information)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), rubric_id (uuid, required, third), grade_agent_id (uuid, required, fourth), agent_id_param (uuid, required, fifth), mcp (boolean, optional, sixth)
-- Returns: id (uuid) - unique resource id
-- Note: agent_id_param is the agent_id field in the resource table (different from the function's agent_id parameter)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_scenario_rubric_grade_agents_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_scenario_rubric_grade_agents_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_scenario_rubric_grade_agents_v4(agent_id uuid,
    group_id uuid,
    rubric_id uuid,
    grade_agent_id uuid,
    agent_id_param uuid,
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
    -- Validate that rubric exists
    IF NOT EXISTS (SELECT 1 FROM rubric_artifact WHERE id = api_create_scenario_rubric_grade_agents_v4.rubric_id) THEN
        RAISE EXCEPTION 'Rubric % does not exist', api_create_scenario_rubric_grade_agents_v4.rubric_id;
    END IF;
    
    -- Validate that grade_agent exists
    IF NOT EXISTS (SELECT 1 FROM agent_artifact WHERE id = api_create_scenario_rubric_grade_agents_v4.grade_agent_id) THEN
        RAISE EXCEPTION 'Grade agent % does not exist', api_create_scenario_rubric_grade_agents_v4.grade_agent_id;
    END IF;
    
    -- Validate that agent_id_param exists
    IF NOT EXISTS (SELECT 1 FROM agent_artifact WHERE id = api_create_scenario_rubric_grade_agents_v4.agent_id_param) THEN
        RAISE EXCEPTION 'Agent % does not exist', api_create_scenario_rubric_grade_agents_v4.agent_id_param;
    END IF;
    
    -- Lookup tool_id from agent_tools + resource_tools
    SELECT t.id, tt.template_id, st.schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN tool_templates tt ON tt.tool_id = t.id
    LEFT JOIN schema_templates st ON st.template_id = tt.template_id
    WHERE at.agent_id = api_create_scenario_rubric_grade_agents_v4.agent_id
      AND rt.resource = 'scenario_rubric_grade_agents'::resources
      AND at.active = true
      AND t.active = true
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource scenario_rubric_grade_agents', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags 
            WHERE agent_id = api_create_scenario_rubric_grade_agents_v4.agent_id 
              AND type = 'mcp'::type_agent_flags 
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Dynamically build arguments_raw FROM schema_fields_resource and Jinja templates
    -- Build a JSONB object with all function parameters first (for lookup)
    v_params_jsonb := jsonb_build_object('rubric_id', rubric_id, 'grade_agent_id', grade_agent_id, 'agent_id', agent_id_param);
    
    -- For each schema field, extract variable names from template or use field name directly
    FOR v_arg_key, v_arg_value IN
        SELECT 
            CASE 
                -- If template is empty, use field name as argument name
                WHEN COALESCE(sf.template, '') = '' THEN sf.name
                -- If template has variables, extract first variable name (before . or |)
                -- Pattern: {{ variable }} or {{ variable.property }} or {{ variable|filter }}
                ELSE COALESCE(
                    (SELECT regexp_replace(
                        regexp_replace(sf.template, '.*\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)', '\1'),
                        '[\.\|].*', ''
                    )),
                    sf.name  -- Fallback to field name if extraction fails
                )
            END as arg_key,
            -- Look up value from function parameters using schema field name
            v_params_jsonb->>sf.name as arg_value
        FROM schema_fields_resource sf
        WHERE sf.schema_id = v_schema_id
        ORDER BY sf.position
    LOOP
        IF v_arg_value IS NOT NULL THEN
            v_args_jsonb := v_args_jsonb || jsonb_build_object(v_arg_key, v_arg_value);
        END IF;
    END LOOP;
    
    v_arguments_raw := v_args_jsonb::text;
    
    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'scenario_rubric_grade_agents_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT INTO scenario_rubric_grade_agents_resource table (always insert, never update)
    -- Use ON CONFLICT to handle unique constraint on (rubric_id, grade_agent_id)
    INSERT INTO scenario_rubric_grade_agents_resource(
        id,
        rubric_id,
        grade_agent_id,
        agent_id,
        active,
        generated,
        mcp,
        call_id,
        created_at,
        updated_at
    )
    VALUES (
        uuidv7(),
        api_create_scenario_rubric_grade_agents_v4.rubric_id,
        api_create_scenario_rubric_grade_agents_v4.grade_agent_id,
        api_create_scenario_rubric_grade_agents_v4.agent_id_param,
        true,
        true,
        mcp,
        v_call_id,
        NOW(),
        NOW()
    )
    ON CONFLICT (rubric_id, grade_agent_id) 
    DO UPDATE SET 
        agent_id = EXCLUDED.agent_id,
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
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    VALUES (v_message_id, v_call_id, NOW(), NOW());
    
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
        api_create_scenario_rubric_grade_agents_v4.group_id,
        v_run_id,
        COALESCE(MAX(gr.idx), -1) + 1,
        NOW(),
        NOW()
    FROM group_runs gr
    WHERE gr.group_id = api_create_scenario_rubric_grade_agents_v4.group_id;
    
    -- Return resource id
    RETURN QUERY SELECT v_resource_id;
END;
$$;
