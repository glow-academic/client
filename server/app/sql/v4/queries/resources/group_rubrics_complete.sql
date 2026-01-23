-- Create group_rubrics resource
-- Get or create operation (returns existing ID if group_id + rubric_id already exists)
-- Parameters: agent_id (uuid, required, first), group_id (uuid, required, second), target_group_id (uuid, required, third), rubric_id (uuid, required, fourth), mcp (boolean, optional, fifth)
-- Returns: id (uuid) - unique resource id

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_group_rubrics_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_group_rubrics_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_group_rubrics_v4(agent_id uuid,
    group_id uuid,
    target_group_id uuid,
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
    -- Validate group and rubric exist
    IF NOT EXISTS (SELECT 1 FROM groups_entry WHERE id = api_create_group_rubrics_v4.target_group_id) THEN
        RAISE EXCEPTION 'Group % does not exist', api_create_group_rubrics_v4.target_group_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM rubric_artifact WHERE id = api_create_group_rubrics_v4.rubric_id) THEN
        RAISE EXCEPTION 'Rubric % does not exist', api_create_group_rubrics_v4.rubric_id;
    END IF;

    -- Lookup tool_id from agent_tools_junction + resource_tools_relation
    SELECT t.id, t.id as template_id, NULL::uuid as schema_id
    INTO v_tool_id, v_template_id, v_schema_id
    FROM agent_tools_junction at
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_artifact t ON t.id = tr.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_group_rubrics_v4.agent_id
      AND rt.resource = 'group_rubrics'::resource_type
      AND at.active = true
      AND EXISTS (SELECT 1 FROM tool_flags_junction tf JOIN flags_resource f ON tf.flag_id = f.id WHERE tf.tool_id = t.id AND f.name = 'tool_active' AND tf.value = true)
    LIMIT 1;

    -- Raise error if agent doesn't have tool for resource
    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource group_rubrics', agent_id;
    END IF;

    -- Validate agent has mcp flag when mcp=true
    IF mcp = true AND agent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM agent_flags_junction
            WHERE agent_id = api_create_group_rubrics_v4.agent_id
              AND value = true
        ) THEN
            RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
        END IF;
    END IF;

    -- Check if group_rubrics already exists (match on group_id + rubric_id)
    SELECT r.id INTO v_resource_id
    FROM group_rubrics_resource r
    WHERE r.group_id = api_create_group_rubrics_v4.target_group_id
      AND r.rubric_id = api_create_group_rubrics_v4.rubric_id
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
    INSERT INTO calls_entry (
        id, external_call_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'group_rubrics_' || v_call_id::text,
        v_tool_id,
        v_template_id,
        v_arguments_raw,
        true,
        NOW(),
        NOW()
    );

    -- INSERT INTO group_rubrics_resource table (always insert, never update)
    INSERT INTO group_rubrics_resource (
        group_id,
        rubric_id,
        active,
        generated,
        mcp,
        call_id,
        created_at
    )
    VALUES (
        api_create_group_rubrics_v4.target_group_id,
        api_create_group_rubrics_v4.rubric_id,
        true,
        true,
        mcp,
        v_call_id,
        NOW()
    )
    ON CONFLICT (group_id, rubric_id)
    DO UPDATE SET
        active = true,
        generated = EXCLUDED.generated,
        mcp = EXCLUDED.mcp,
        call_id = EXCLUDED.call_id
    RETURNING group_rubrics_resource.id INTO v_resource_id;

    -- Create message record (assistant role, not completed)
    v_message_id := uuidv7();
    INSERT INTO messages_entry (id, role, completed, audio, created_at, updated_at)
    VALUES (v_message_id, 'assistant'::message_type, false, false, NOW(), NOW());

    -- Link message to call
    UPDATE calls_entry SET message_id = v_message_id WHERE id = v_call_id;

    -- Create run record
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, agent_id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, agent_id, 0, 0, 0, api_create_group_rubrics_v4.group_id, NOW(), NOW());

    -- Link message to run
    UPDATE messages_entry SET run_id = v_run_id WHERE id = v_message_id;


    RETURN QUERY SELECT v_resource_id;
END;
$$;
