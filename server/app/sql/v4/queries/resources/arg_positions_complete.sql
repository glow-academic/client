-- Create/update arg_positions resource for a tool+arg pair

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_create_arg_positions_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_create_arg_positions_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_create_arg_positions_v4(
    agent_id uuid,
    group_id uuid,
    tool_id uuid,
    args_id uuid,
    value integer,
    mcp boolean DEFAULT false
)
RETURNS TABLE (
    id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_resource_id uuid;
    v_call_id uuid;
    v_run_id uuid;
    v_tool_id uuid;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM args_resource WHERE id = api_create_arg_positions_v4.args_id) THEN
        RAISE EXCEPTION 'Arg % does not exist', api_create_arg_positions_v4.args_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM tool_artifact WHERE id = api_create_arg_positions_v4.tool_id) THEN
        RAISE EXCEPTION 'Tool % does not exist', api_create_arg_positions_v4.tool_id;
    END IF;

    SELECT t.id
    INTO v_tool_id
    FROM agent_tools_junction at
    JOIN tools_resource tr ON tr.id = at.tool_id
    JOIN tool_tools_junction ttj ON ttj.tools_id = tr.id
    JOIN tool_artifact t ON t.id = ttj.tool_id
    JOIN resource_tools_relation rt ON rt.tool_id = t.id
    WHERE at.agent_id = api_create_arg_positions_v4.agent_id
      AND rt.resource = 'arg_positions'::resource_type
      AND at.active = true
      AND EXISTS (
          SELECT 1
          FROM tool_flags_junction tf
          JOIN flags_resource f ON tf.flag_id = f.id
          WHERE tf.tool_id = t.id
            AND f.name = 'tool_active'
            AND tf.value = true
      )
    LIMIT 1;

    IF v_tool_id IS NULL THEN
        RAISE EXCEPTION 'Agent % does not have tool for resource arg_positions', agent_id;
    END IF;

    SELECT ap.id
    INTO v_resource_id
    FROM tool_arg_positions_junction tap
    JOIN arg_positions_resource ap ON ap.id = tap.arg_positions_id
    WHERE tap.tool_id = api_create_arg_positions_v4.tool_id
      AND ap.args_id = api_create_arg_positions_v4.args_id
      AND tap.active = true
      AND ap.active = true
    LIMIT 1;

    IF v_resource_id IS NULL THEN
        INSERT INTO arg_positions_resource (id, args_id, value, active, generated, mcp, created_at)
        VALUES (uuidv7(), api_create_arg_positions_v4.args_id, api_create_arg_positions_v4.value, true, true, mcp, NOW())
        RETURNING arg_positions_resource.id INTO v_resource_id;

        INSERT INTO tool_arg_positions_junction (tool_id, arg_positions_id, created_at, active, generated, mcp)
        VALUES (api_create_arg_positions_v4.tool_id, v_resource_id, NOW(), true, true, mcp)
        ON CONFLICT ON CONSTRAINT tool_arg_positions_junction_pkey DO UPDATE
        SET active = true,
            generated = EXCLUDED.generated,
            mcp = EXCLUDED.mcp;
    ELSE
        UPDATE arg_positions_resource
        SET value = api_create_arg_positions_v4.value,
            active = true,
            generated = true,
            mcp = api_create_arg_positions_v4.mcp
        WHERE arg_positions_resource.id = v_resource_id;
    END IF;

    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, api_create_arg_positions_v4.group_id, NOW(), NOW());

    v_call_id := uuidv7();
    INSERT INTO calls_entry (
        id, external_call_id, run_id, tool_id, template_id, arguments_raw, completed, created_at, updated_at
    )
    VALUES (
        v_call_id,
        'arg_positions_' || v_call_id::text,
        v_run_id,
        v_tool_id,
        NULL,
        '{}'::text,
        true,
        NOW(),
        NOW()
    );

    INSERT INTO tools_calls_connection (tools_id, call_id)
    VALUES (v_tool_id, v_call_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO arg_positions_calls_connection (arg_positions_id, call_id)
    VALUES (v_resource_id, v_call_id)
    ON CONFLICT DO NOTHING;

    RETURN QUERY SELECT v_resource_id;
END;
$$;

