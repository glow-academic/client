-- Unified save tool function - section-action based (persona parity)

DO $$
BEGIN
    DROP TYPE IF EXISTS types.tool_resource_action CASCADE;
    CREATE TYPE types.tool_resource_action AS (
        resources_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.tool_multi_resource_action CASCADE;
    CREATE TYPE types.tool_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_tool_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_tool_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_tool_v4(
    profile_id uuid,
    group_id uuid,
    input_tool_id uuid DEFAULT NULL,
    names types.tool_resource_action DEFAULT NULL,
    descriptions types.tool_resource_action DEFAULT NULL,
    flags types.tool_resource_action DEFAULT NULL,
    args types.tool_multi_resource_action DEFAULT NULL,
    arg_positions types.tool_multi_resource_action DEFAULT NULL,
    args_outputs types.tool_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    tool_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
-- User context (actor_name, user_role, department_ids) comes from get_profile_context_internal() in Python
#variable_conflict use_column
DECLARE
    v_tool_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_args_ids uuid[];
    v_arg_position_ids uuid[];
    v_args_outputs_ids uuid[];
    is_create boolean;
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resources_id;
    v_description_id := (descriptions).resources_id;
    v_active_flag_id := (flags).resources_id;
    v_args_ids := COALESCE((args).resource_ids, ARRAY[]::uuid[]);
    v_arg_position_ids := COALESCE((arg_positions).resource_ids, ARRAY[]::uuid[]);
    v_args_outputs_ids := COALESCE((args_outputs).resource_ids, ARRAY[]::uuid[]);

    IF group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_args_ids) AS args_id
            WHERE NOT EXISTS (SELECT 1 FROM args_resource WHERE id = args_id)
        ) THEN
            RAISE EXCEPTION 'One or more args resources not found';
        END IF;
    END IF;

    IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_args_outputs_ids) AS args_outputs_id
            WHERE NOT EXISTS (SELECT 1 FROM args_outputs_resource WHERE id = args_outputs_id)
        ) THEN
            RAISE EXCEPTION 'One or more args_outputs resources not found';
        END IF;
    END IF;

    IF COALESCE(array_length(v_arg_position_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_arg_position_ids) AS arg_positions_id
            WHERE NOT EXISTS (SELECT 1 FROM arg_positions_resource WHERE id = arg_positions_id)
        ) THEN
            RAISE EXCEPTION 'One or more arg_positions resources not found';
        END IF;
    END IF;

    is_create := input_tool_id IS NULL;

    IF is_create THEN
        INSERT INTO tool_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_tool_id;
    ELSE
        v_tool_id := input_tool_id;
        UPDATE tool_artifact SET updated_at = NOW() WHERE id = v_tool_id;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Tool not found: %', input_tool_id;
        END IF;

        UPDATE tool_names_junction SET active = false WHERE tool_id = v_tool_id;
        UPDATE tool_descriptions_junction SET active = false WHERE tool_id = v_tool_id;
        UPDATE tool_flags_junction SET active = false WHERE tool_id = v_tool_id;
        DELETE FROM tool_args_junction WHERE tool_id = v_tool_id;
        UPDATE tool_arg_positions_junction SET active = false WHERE tool_id = v_tool_id;
        DELETE FROM tool_args_outputs_junction WHERE tool_id = v_tool_id;
    END IF;

    INSERT INTO tool_names_junction (tool_id, names_id, created_at, generated, mcp, active)
    VALUES (v_tool_id, v_name_id, NOW(), false, false, true)
    ON CONFLICT ON CONSTRAINT tool_names_pkey DO UPDATE
    SET active = true;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO tool_descriptions_junction (tool_id, descriptions_id, created_at, generated, mcp, active)
        VALUES (v_tool_id, v_description_id, NOW(), false, false, true)
        ON CONFLICT ON CONSTRAINT tool_descriptions_pkey DO UPDATE
        SET active = true;
    END IF;

    INSERT INTO tool_flags_junction (tool_id, flag_id, created_at, generated, mcp, active)
    SELECT
        v_tool_id,
        COALESCE(v_active_flag_id, f.id),
        NOW(),
        false,
        false,
        true
    FROM flags_resource f
    WHERE f.name = 'tool_active'
    ON CONFLICT ON CONSTRAINT tool_flags_pkey DO UPDATE SET
        flag_id = COALESCE(EXCLUDED.flag_id, tool_flags_junction.flag_id),
        active = true;

    IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
        INSERT INTO tool_args_junction (tool_id, args_id, created_at, generated, mcp)
        SELECT v_tool_id, args_id, NOW(), false, false
        FROM UNNEST(v_args_ids) AS args_id
        ON CONFLICT ON CONSTRAINT tool_args_pkey DO NOTHING;
    END IF;

    IF COALESCE(array_length(v_arg_position_ids, 1), 0) > 0 THEN
        INSERT INTO tool_arg_positions_junction (
            tool_id, arg_positions_id, created_at, generated, mcp, active
        )
        SELECT v_tool_id, arg_positions_id, NOW(), false, false, true
        FROM UNNEST(v_arg_position_ids) AS arg_positions_id
        ON CONFLICT ON CONSTRAINT tool_arg_positions_junction_pkey DO UPDATE
        SET active = true,
            generated = EXCLUDED.generated,
            mcp = EXCLUDED.mcp;
    END IF;

    IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
        INSERT INTO tool_args_outputs_junction (tool_id, args_outputs_id, created_at, generated, mcp, active)
        SELECT v_tool_id, args_outputs_id, NOW(), false, false, true
        FROM UNNEST(v_args_outputs_ids) AS args_outputs_id
        ON CONFLICT ON CONSTRAINT tool_args_outputs_pkey DO UPDATE
        SET active = true,
            generated = EXCLUDED.generated,
            mcp = EXCLUDED.mcp;
    END IF;

    -- Sync denormalized args_ids and args_output_ids on tools_resource
    UPDATE tools_resource
    SET args_ids = v_args_ids,
        args_output_ids = v_args_outputs_ids
    FROM tool_tools_junction ttj
    WHERE ttj.tool_id = v_tool_id
    AND tools_resource.id = ttj.tool_id;

    -- Tool call lineage for save
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, group_id, created_at, updated_at)
    VALUES (v_run_id, group_id, NOW(), NOW());

    IF (names).create_tool_id IS NOT NULL THEN
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'tool_save_create_names_' || v_call_id::text, v_run_id, NOW());
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
        INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
    END IF;
    IF (names).link_tool_id IS NOT NULL THEN
        v_call_id := uuidv7();
        INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
        VALUES (v_call_id, 'tool_save_link_names_' || v_call_id::text, v_run_id, NOW());
        INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
        INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
    END IF;

    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
        IF (args).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_create_args_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args).create_tool_id, v_call_id);
        END IF;
        IF (args).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_link_args_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args).link_tool_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_arg_position_ids, 1), 0) > 0 THEN
        IF (arg_positions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_create_arg_positions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((arg_positions).create_tool_id, v_call_id);
        END IF;
        IF (arg_positions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_link_arg_positions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((arg_positions).link_tool_id, v_call_id);
        END IF;
    END IF;

    IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
        IF (args_outputs).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_create_args_outputs_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args_outputs).create_tool_id, v_call_id);
        END IF;
        IF (args_outputs).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'tool_save_link_args_outputs_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args_outputs).link_tool_id, v_call_id);
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_tool_id;
END;
$$;

