-- Create departments resource
-- Accepts a resource_id (departments_resource.id) and creates auditing entries (call, message, run)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), department_id (uuid, required, third - this is the resource_id), mcp (boolean, optional, fourth)
-- Returns: id (uuid) - the resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_departments_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_departments_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_departments_v4(agent_id uuid,
    group_id uuid,
    department_id uuid,
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
    v_args_jsonb jsonb := '{}'::jsonb;
    v_message_id uuid;
    v_run_id uuid;
BEGIN
    -- department_id parameter is actually the resource_id (departments_resource.id)
    v_resource_id := api_create_departments_v4.department_id;

    -- Look up the artifact_id from departments_resource table
    SELECT dr.department_id INTO v_artifact_id
    FROM departments_resource dr
    WHERE dr.id = v_resource_id;

    -- Resource must exist (it should always be in the available list)
    IF v_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Department resource % does not exist', v_resource_id;
    END IF;

    -- Lookup tool_id from agent_tools_junction + resource_tools_relation
    SELECT t.id, t.id as template_id
    INTO v_tool_id, v_template_id
    FROM agent_tools_junction at
    JOIN tool_artifact t ON t.id = at.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_departments_v4.agent_id
      AND rt.resource = 'departments'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;

    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource departments', agent_id;
    END IF;

    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction
            WHERE agent_id = api_create_departments_v4.agent_id
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;

    -- Build arguments_raw directly from params
    v_arguments_raw := v_args_jsonb::text;

    -- Create call record
    v_call_id := uuidv7();
    INSERT INTO calls_entry (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'departments_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- Update the existing resource with the new call_id and mark as generated
    UPDATE departments_resource
    SET call_id = v_call_id, generated = true, mcp = api_create_departments_v4.mcp
    WHERE departments_resource.id = v_resource_id;

    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO messages_entry (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_type, false, false, NOW(), NOW());

    -- Link message to call
    UPDATE calls_entry SET message_id = v_message_id WHERE id = v_call_id;

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, agent_id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, agent_id, 0, 0, 0, api_create_departments_v4.group_id, NOW(), NOW());

    -- Link message to run
    UPDATE messages_entry SET run_id = v_run_id WHERE id = v_message_id;

    RETURN QUERY SELECT v_resource_id;
END;
$$;
