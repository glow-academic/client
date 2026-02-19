-- Patch tool draft - section-action based (persona parity)

DO $$
BEGIN
    DROP TYPE IF EXISTS types.tool_resource_action CASCADE;
    CREATE TYPE types.tool_resource_action AS (
        resource_id uuid,
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
        WHERE proname = 'api_patch_tool_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_tool_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_tool_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.tool_resource_action DEFAULT NULL,
    descriptions types.tool_resource_action DEFAULT NULL,
    flags types.tool_resource_action DEFAULT NULL,
    args types.tool_multi_resource_action DEFAULT NULL,
    arg_positions types.tool_multi_resource_action DEFAULT NULL,
    args_outputs types.tool_multi_resource_action DEFAULT NULL,
    expected_version int DEFAULT 0
)
RETURNS TABLE (
    draft_id uuid,
    new_version int,
    draft_exists boolean
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;
    v_profiles_resource_id uuid;
    v_group_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_args_ids uuid[];
    v_arg_position_ids uuid[];
    v_args_outputs_ids uuid[];
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_args_ids := COALESCE((args).resource_ids, ARRAY[]::uuid[]);
    v_arg_position_ids := COALESCE((arg_positions).resource_ids, ARRAY[]::uuid[]);
    v_args_outputs_ids := COALESCE((args_outputs).resource_ids, ARRAY[]::uuid[]);

    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = api_patch_tool_draft_v4.profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', profile_id;
    END IF;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
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

    IF input_draft_id IS NOT NULL THEN
        SELECT d.group_id INTO v_group_id FROM tool_drafts_entry d WHERE d.id = input_draft_id;

        IF v_group_id IS NULL THEN
            v_group_id := group_id;
        END IF;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE profile_id = api_patch_tool_draft_v4.profile_id
                      AND active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE tool_drafts_entry
        SET
            version = tool_drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(tool_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM tool_drafts_profiles_connection pdj
              WHERE pdj.draft_id = tool_drafts_entry.id
                AND pdj.profiles_id = v_profiles_resource_id
          )
          AND tool_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        v_group_id := COALESCE(group_id, v_group_id);

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE profile_id = api_patch_tool_draft_v4.profile_id
                      AND active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO tool_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO tool_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    DELETE FROM tool_drafts_names_connection WHERE tool_drafts_names_connection.draft_id = v_draft_id;
    DELETE FROM tool_drafts_descriptions_connection WHERE tool_drafts_descriptions_connection.draft_id = v_draft_id;
    DELETE FROM tool_drafts_flags_connection WHERE tool_drafts_flags_connection.draft_id = v_draft_id;
    DELETE FROM tool_drafts_args_connection WHERE tool_drafts_args_connection.draft_id = v_draft_id;
    DELETE FROM tool_drafts_arg_positions_connection WHERE tool_drafts_arg_positions_connection.draft_id = v_draft_id;
    DELETE FROM tool_drafts_args_outputs_connection WHERE tool_drafts_args_outputs_connection.draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO tool_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO tool_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO tool_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
        INSERT INTO tool_drafts_args_connection (draft_id, args_id, version, generated, mcp)
        SELECT v_draft_id, args_id, v_new_version, false, false
        FROM UNNEST(v_args_ids) AS args_id
        ON CONFLICT ON CONSTRAINT args_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_arg_position_ids, 1), 0) > 0 THEN
        INSERT INTO tool_drafts_arg_positions_connection (
            draft_id, arg_positions_id, version, generated, mcp, active
        )
        SELECT v_draft_id, arg_positions_id, v_new_version, false, false, true
        FROM UNNEST(v_arg_position_ids) AS arg_positions_id
        ON CONFLICT ON CONSTRAINT arg_positions_draft_pkey DO UPDATE
        SET version = v_new_version,
            active = true;
    END IF;

    IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
        INSERT INTO tool_drafts_args_outputs_connection (draft_id, args_outputs_id, version, generated, mcp)
        SELECT v_draft_id, args_outputs_id, v_new_version, false, false
        FROM UNNEST(v_args_outputs_ids) AS args_outputs_id
        ON CONFLICT ON CONSTRAINT args_outputs_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    -- Draft tool-call lineage only when group exists
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
        END IF;

        IF v_description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
        END IF;

        IF v_active_flag_id IS NOT NULL THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
            END IF;
        END IF;

        IF COALESCE(array_length(v_args_ids, 1), 0) > 0 THEN
            IF (args).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_args_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args).create_tool_id, v_call_id);
                INSERT INTO args_calls_connection (args_id, call_id)
                SELECT args_id, v_call_id FROM UNNEST(v_args_ids) AS args_id;
            END IF;
            IF (args).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_args_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args).link_tool_id, v_call_id);
                INSERT INTO args_calls_connection (args_id, call_id)
                SELECT args_id, v_call_id FROM UNNEST(v_args_ids) AS args_id;
            END IF;
        END IF;

        IF COALESCE(array_length(v_arg_position_ids, 1), 0) > 0 THEN
            IF (arg_positions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_arg_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((arg_positions).create_tool_id, v_call_id);
                INSERT INTO arg_positions_calls_connection (arg_positions_id, call_id)
                SELECT arg_positions_id, v_call_id FROM UNNEST(v_arg_position_ids) AS arg_positions_id;
            END IF;
            IF (arg_positions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_arg_positions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((arg_positions).link_tool_id, v_call_id);
                INSERT INTO arg_positions_calls_connection (arg_positions_id, call_id)
                SELECT arg_positions_id, v_call_id FROM UNNEST(v_arg_position_ids) AS arg_positions_id;
            END IF;
        END IF;

        IF COALESCE(array_length(v_args_outputs_ids, 1), 0) > 0 THEN
            IF (args_outputs).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_create_args_outputs_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args_outputs).create_tool_id, v_call_id);
                INSERT INTO args_outputs_calls_connection (args_outputs_id, call_id)
                SELECT args_outputs_id, v_call_id FROM UNNEST(v_args_outputs_ids) AS args_outputs_id;
            END IF;
            IF (args_outputs).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'tool_draft_link_args_outputs_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((args_outputs).link_tool_id, v_call_id);
                INSERT INTO args_outputs_calls_connection (args_outputs_id, call_id)
                SELECT args_outputs_id, v_call_id FROM UNNEST(v_args_outputs_ids) AS args_outputs_id;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
