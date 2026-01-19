-- Create default_accounts resource
-- Always INSERT operation (preserves all information)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), profile_id (uuid, required, third), type (default_account_type, required, fourth), mcp (boolean, optional, fifth)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oidvectortypes(proargtypes) as sig 
        FROM pg_proc 
        WHERE proname = 'api_create_default_accounts_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_default_accounts_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_default_accounts_v4(agent_id uuid,
    group_id uuid,
    profile_id uuid,
    type default_account_type,
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
    -- Lookup tool_id from agent_tools + resource_tools
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_default_accounts_v4.agent_id
      AND rt.resource = 'default_accounts'::resources
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'active' AND tf.value = true)
    LIMIT 1;
    
    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource default_accounts', agent_id;
    END IF;
    
    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags af
            JOIN flags_resource f ON af.flag_id = f.id
            WHERE af.agent_id = api_create_default_accounts_v4.agent_id 
              AND f.name = 'mcp'
              AND af.value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;
    
    -- Build arguments_raw directly from params (templates removed)
    v_args_jsonb := '{}'::jsonb;
    v_arguments_raw := v_args_jsonb::text;
    
    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls (id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at)
    VALUES (v_call_id, 'default_accounts_' || v_call_id::text, v_tool_id, v_template_id, v_arguments_raw, true, NOW(), NOW());
    
    -- Create default_accounts_resource entry
    v_resource_id := uuidv7();
    INSERT INTO default_accounts_resource(id, profile_id, type, active, generated, mcp, call_id, group_id, created_at, updated_at)
    VALUES (v_resource_id, api_create_default_accounts_v4.profile_id, api_create_default_accounts_v4.type, true, true, mcp, v_call_id, api_create_default_accounts_v4.group_id, NOW(), NOW());
    
    -- Create message record
    v_message_id := uuidv7();
    INSERT INTO messages (id, role, content, call_id, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_role, 'Created default_accounts resource', v_call_id, NOW(), NOW());
    
    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs (id, input_tokens, output_tokens, key_id, agent_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, NULL, api_create_default_accounts_v4.agent_id, NOW(), NOW());
    
    -- Link message to run
    INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
    VALUES (v_message_id, v_run_id, NOW(), NOW());
    
    RETURN QUERY SELECT v_resource_id;
END;
$$;
