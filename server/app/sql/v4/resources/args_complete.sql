-- Create args resource
-- Always INSERT operation (preserves all information)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), mcp (boolean, optional, third), name (text), description (text), field_type (text), required (boolean), default_value (text), position_value (integer)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_args_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_args_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_args_v4(
    agent_id uuid,
    group_id uuid,
    name text,
    description text DEFAULT '',
    field_type text DEFAULT 'string',
    required boolean DEFAULT false,
    default_value text DEFAULT '',
    position_value integer DEFAULT 0,
    mcp boolean DEFAULT false
)
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
    -- Lookup tool_id from agent_tools + resource_tools
    -- Note: No longer need template_id or schema_id since we use tool_args directly
    SELECT t.id
    INTO v_tool_id
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_args_v4.agent_id
      AND rt.resource = 'args'::resources
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.type = 'active'::type_tool_flags AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource args', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags 
            WHERE agent_id = api_create_args_v4.agent_id 
              AND type = 'mcp'::type_agent_flags 
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Dynamically build arguments_raw FROM tool_args → args_resource
    -- Build a JSONB object with all function parameters first (for lookup)
    v_params_jsonb := jsonb_build_object(
        'name', name,
        'description', description,
        'field_type', field_type,
        'required', required,
        'default_value', default_value,
        'position_value', position_value
    );
    
    -- For each args_resource entry linked to the tool, extract variable names from template or use field name directly
    -- Only if tool_id exists
    IF v_tool_id IS NOT NULL THEN
        FOR v_arg_key, v_arg_value IN
            SELECT 
                CASE 
                    -- If template is empty, use field name as argument name
                    -- Note: args_resource doesn't have template field, so always use name
                    ar.name as arg_key,
                    -- Look up value from function parameters using args_resource name
                    v_params_jsonb->>ar.name as arg_value
            FROM tool_args ta
            JOIN args_resource ar ON ar.id = ta.args_id
            WHERE ta.tool_id = v_tool_id
              AND ar.active = true
            ORDER BY ar.position NULLS LAST, ar.created_at
        LOOP
            IF v_arg_value IS NOT NULL THEN
                v_args_jsonb := v_args_jsonb || jsonb_build_object(v_arg_key, v_arg_value);
            END IF;
        END LOOP;
    END IF;
    
    v_arguments_raw := v_args_jsonb::text;
    
    -- Create call record
    -- Note: template_id is no longer needed since we use tool_args_outputs directly
    v_call_id := uuidv7();
    INSERT INTO calls (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'args_' || v_call_id::text,
        v_tool_id,
        NULL,  -- template_id no longer used
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT INTO args_resource table (always insert, never update)
    INSERT INTO args_resource(
        id, name, description, field_type, required, default_value, position, 
        active, generated, mcp, call_id, created_at, updated_at
    )
    VALUES (
        uuidv7(), 
        api_create_args_v4.name,
        api_create_args_v4.description,
        api_create_args_v4.field_type,
        api_create_args_v4.required,
        api_create_args_v4.default_value,
        api_create_args_v4.position_value,
        true, 
        true, 
        mcp, 
        v_call_id, 
        NOW(), 
        NOW()
    )
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
    VALUES (v_run_id, api_create_args_v4.agent_id, 0, 0, 0, NOW(), NOW());
    
    -- Link message to run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    VALUES (v_message_id, v_run_id, NOW(), NOW());
    
    -- Link run to group (calculate idx)
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT 
        api_create_args_v4.group_id,
        v_run_id,
        COALESCE((SELECT MAX(gr.idx) FROM group_runs gr WHERE gr.group_id = api_create_args_v4.group_id), -1) + 1,
        NOW(),
        NOW();
    
    -- Return resource id
    RETURN QUERY SELECT v_resource_id;
END;
$$;
