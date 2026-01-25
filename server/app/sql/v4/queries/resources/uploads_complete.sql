-- Create uploads_entry resource
-- Get or create operation (returns existing ID if upload_id + group_id already exists)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), mcp (boolean, optional, third), upload_id (uuid)
-- Returns: uploads_id (uuid)

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_uploads_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_uploads_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_uploads_v4(agent_id uuid,
    group_id uuid,
    upload_id uuid,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    uploads_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_uploads_id uuid;
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
    WHERE at.agent_id = api_create_uploads_v4.agent_id
      AND rt.resource = 'uploads'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource uploads_entry', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction 
            WHERE agent_id = api_create_uploads_v4.agent_id 
              AND type = 'mcp'::type_agent_flags
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Validate upload_id exists
    IF NOT EXISTS (SELECT 1 FROM uploads_entry WHERE id = upload_id) THEN
        RAISE EXCEPTION 'Upload % does not exist', upload_id;
    END IF;
    
    -- Check if uploads_resource entry already exists for this upload_id
    SELECT id INTO v_uploads_id
    FROM uploads_resource
    WHERE upload_id = api_create_uploads_v4.upload_id
    LIMIT 1;
    
    -- If exists, return existing ID
    IF v_uploads_id IS NOT NULL THEN
        RETURN QUERY SELECT v_uploads_id;
        RETURN;
    END IF;

    -- Check if uploads_entry already exists (match on upload_id + group_id)
    SELECT r.id INTO v_uploads_id
    FROM uploads_resource r
    WHERE r.upload_id = v_artifact_id
      AND r.group_id = api_create_uploads_v4.group_id
    LIMIT 1;

    IF v_uploads_id IS NOT NULL THEN
        RETURN QUERY SELECT v_uploads_id;
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
        'uploads_' || v_call_id::text,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- Link tool to call
    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES (v_tool_id);
    
    -- INSERT INTO uploads_resource table (always insert, never update)
    INSERT INTO uploads_resource(active, mcp)
    VALUES (upload_id, true, mcp, api_create_uploads_v4.group_id)
    RETURNING id INTO v_uploads_id;
    
    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO messages_entry (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_type, false, false, NOW(), NOW());

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, api_create_uploads_v4.group_id, NOW(), NOW());

    -- Link agent to run
    INSERT INTO agent_runs_junction (agent_id, run_id) VALUES (api_create_uploads_v4.agent_id, v_run_id);
    
    -- Link call to run
    UPDATE calls_entry SET run_id = v_run_id WHERE id = v_call_id;

    -- Link message to run
    UPDATE messages_entry SET run_id = v_run_id WHERE id = v_message_id;
    
    
    RETURN QUERY SELECT v_uploads_id;
END;
$$;
