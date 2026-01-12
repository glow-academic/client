-- Create settings resource
-- Always INSERT operation (preserves all information)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), setting_id (uuid, required, third), mcp (boolean, optional, fourth)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_settings_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_settings_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_settings_v4(agent_id uuid,
    group_id uuid,
    setting_id uuid,
    mcp boolean DEFAULT false)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_resource_id uuid;
    v_artifact_id uuid;
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
    -- Use provided setting_id as artifact_id
    v_artifact_id := api_create_settings_v4.setting_id;
    
    -- Validate that setting artifact exists
    IF NOT EXISTS (SELECT 1 FROM setting WHERE id = v_artifact_id) THEN
        RAISE EXCEPTION 'Setting artifact % does not exist', v_artifact_id;
    END IF;
    -- Lookup tool_id from agent_tools + resource_tools
    SELECT t.id, tt.template_id, st.schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools at
    JOIN tool t ON t.id = at.tool_id
    JOIN resource_tools rt ON rt.tool_id = t.id
    LEFT JOIN tool_templates tt ON tt.tool_id = t.id
    LEFT JOIN schema_templates st ON st.template_id = tt.template_id
    WHERE at.agent_id = api_create_settings_v4.agent_id
      AND rt.resource = 'settings'::resources
      AND at.active = true
      AND t.active = true
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource settings', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags 
            WHERE agent_id = api_create_settings_v4.agent_id 
              AND type = 'mcp'::type_agent_flags 
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Dynamically build arguments_raw from schema_fields and Jinja templates
    -- Build a JSONB object with all function parameters first (for lookup)
    v_params_jsonb := jsonb_build_object('setting_id', setting_id);
    
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
        FROM schema_fields sf
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
        'settings_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );
    
    -- INSERT into settings table (always insert, never update)
    -- INSERT into settings table (always insert, never update)
    -- Create resource with new unique id and setting_id FK
    INSERT INTO settings(id, setting_id, active, generated, mcp, call_id, group_id, created_at, updated_at)
    VALUES (uuidv7(), v_artifact_id, true, true, mcp, v_call_id, api_create_settings_v4.group_id, NOW(), NOW())
    RETURNING id INTO v_resource_id;
    
    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO message (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_role, false, false, NOW(), NOW());
    
    -- Link message to call
    INSERT INTO message_calls (message_id, call_id, created_at, updated_at)
    VALUES (v_message_id, v_call_id, NOW(), NOW());
    
    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO run (id, agent_id, input_tokens, output_tokens, cached_input_tokens, created_at, updated_at)
    VALUES (v_run_id, agent_id, 0, 0, 0, NOW(), NOW());
    
    -- Link run to message
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    VALUES (v_message_id, v_run_id, NOW(), NOW());
    
    -- Link run to group (calculate idx)
    INSERT INTO group_runs (group_id, run_id, idx, created_at, updated_at)
    SELECT 
        api_create_settings_v4.group_id,
        v_run_id,
        COALESCE((SELECT MAX(gr.idx) FROM group_runs gr WHERE gr.group_id = api_create_settings_v4.group_id), -1) + 1,
        NOW(),
        NOW();
    
    RETURN QUERY SELECT v_resource_id;
END;
$$;
