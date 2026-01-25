-- Create colors resource
-- Get or create operation (returns existing ID if hex_code already exists)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), name (text), description (text), hex_code (text)
-- Returns: color_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_colors_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_colors_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_colors_v4(agent_id uuid,
    group_id uuid,
    name text,
    description text,
    hex_code text,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    color_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_color_id uuid;
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
    -- Lookup tool_id from agent_tools_junction + resource_tools_relation
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools_junction at
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact t ON t.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_colors_v4.agent_id
      AND rt.resource = 'colors'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource colors', agent_id;
    END IF;
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction 
            WHERE agent_id = api_create_colors_v4.agent_id 
               
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;

    -- Check if color already exists (match on hex_code)
    SELECT cr.id INTO v_color_id
    FROM colors_resource cr
    WHERE cr.hex_code = api_create_colors_v4.hex_code
    LIMIT 1;

    IF v_color_id IS NOT NULL THEN
        RETURN QUERY SELECT v_color_id;
        RETURN;
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
        'colors_' || v_call_id::text,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- Link tool to call
    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES (v_tool_id);
    
    -- INSERT INTO colors_resource table (always insert, never update)
    INSERT INTO colors_resource(name, description, hex_code, active, mcp)
    VALUES (name, description, hex_code, true, mcp)
    RETURNING id INTO v_color_id;
    
    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO messages_entry (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_type, false, false, NOW(), NOW());

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, api_create_colors_v4.group_id, NOW(), NOW());

    -- Link agent to run
    INSERT INTO agent_runs_junction (agent_id, run_id) VALUES (api_create_colors_v4.agent_id, v_run_id);
    
    -- Link call to run
    UPDATE calls_entry SET run_id = v_run_id WHERE id = v_call_id;

    -- Link message to run
    UPDATE messages_entry SET run_id = v_run_id WHERE id = v_message_id;
    
    
    RETURN QUERY SELECT v_color_id;
END;
$$;
