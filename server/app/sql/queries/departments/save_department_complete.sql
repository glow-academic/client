-- Save department with nested resource actions and tool-call tracking.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.department_resource_action CASCADE;
    CREATE TYPE types.department_resource_action AS (
        resources_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.department_multi_resource_action CASCADE;
    CREATE TYPE types.department_multi_resource_action AS (
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
        SELECT oidvectortypes(proargtypes) AS sig
        FROM pg_proc
        WHERE proname = 'api_save_department_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_department_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_department_v4(
    profile_id uuid,
    group_id uuid,
    input_department_id uuid DEFAULT NULL,
    names types.department_resource_action DEFAULT NULL,
    descriptions types.department_resource_action DEFAULT NULL,
    flags types.department_resource_action DEFAULT NULL,
    settings types.department_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    department_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_department_id uuid;
    v_profile_id uuid := profile_id;
    v_group_id uuid := group_id;
    v_input_department_id uuid := input_department_id;

    v_name_id uuid := (names).resources_id;
    v_description_id uuid := (descriptions).resources_id;
    v_active_flag_id uuid := (flags).resources_id;
    v_settings_ids uuid[] := COALESCE((settings).resource_ids, ARRAY[]::uuid[]);

    v_run_id uuid;
    v_call_id uuid;
    v_default_department_active_flag_id uuid;
    is_create boolean := (input_department_id IS NULL);
BEGIN
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;
    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
    END IF;

    SELECT id INTO v_default_department_active_flag_id
    FROM flags_resource
    WHERE name = 'department_active'
    LIMIT 1;

    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;
    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;
    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;
    IF v_settings_ids IS NOT NULL AND EXISTS (
        SELECT 1
        FROM unnest(v_settings_ids) AS setting_id
        WHERE NOT EXISTS (SELECT 1 FROM settings_resource WHERE id = setting_id)
    ) THEN
        RAISE EXCEPTION 'Settings resource not found';
    END IF;

    IF is_create THEN
        INSERT INTO department_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_department_id;
    ELSE
        v_department_id := v_input_department_id;
        UPDATE department_artifact
        SET updated_at = NOW()
        WHERE id = v_department_id;
    END IF;

    -- Reset links then reinsert from current action payload.
    DELETE FROM department_names_junction WHERE department_id = v_department_id;
    DELETE FROM department_descriptions_junction WHERE department_id = v_department_id;
    DELETE FROM department_settings_junction WHERE department_id = v_department_id;

    INSERT INTO department_names_junction (department_id, names_id, created_at)
    VALUES (v_department_id, v_name_id, NOW())
    ON CONFLICT ON CONSTRAINT department_names_pkey DO NOTHING;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO department_descriptions_junction (department_id, descriptions_id, created_at)
        VALUES (v_department_id, v_description_id, NOW())
        ON CONFLICT ON CONSTRAINT department_descriptions_pkey DO NOTHING;
    END IF;

    INSERT INTO department_flags_junction (department_id, flags_id, created_at)
    VALUES (
        v_department_id,
        COALESCE(v_active_flag_id, v_default_department_active_flag_id),
        NOW()
    )
    ON CONFLICT ON CONSTRAINT department_flags_pkey DO UPDATE
    SET flags_id = EXCLUDED.flags_id;

    IF COALESCE(array_length(v_settings_ids, 1), 0) > 0 THEN
        INSERT INTO department_settings_junction (settings_id, department_id, active, created_at)
        SELECT setting_id, v_department_id, true, NOW()
        FROM unnest(v_settings_ids) AS setting_id
        ON CONFLICT ON CONSTRAINT department_settings_pkey DO UPDATE
        SET active = true;
    END IF;

    -- Keep mirror resource table values in sync.
    UPDATE departments_resource r
    SET name = n.name,
        description = d.description
    FROM department_departments_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.department_id = r.id
      AND j.department_id = v_department_id;

    -- Tool-call lineage
    IF v_group_id IS NOT NULL THEN
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (uuidv7(), 0, 0, 0, v_group_id, NOW(), NOW())
        RETURNING id INTO v_run_id;
    END IF;

    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_create_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_link_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_settings_ids, 1), 0) > 0 THEN
        IF (settings).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_create_settings_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((settings).create_tool_id, v_call_id);
            INSERT INTO settings_calls_connection (settings_id, call_id)
            SELECT setting_id, v_call_id FROM unnest(v_settings_ids) AS setting_id;
        END IF;
        IF (settings).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'department_link_settings_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((settings).link_tool_id, v_call_id);
            INSERT INTO settings_calls_connection (settings_id, call_id)
            SELECT setting_id, v_call_id FROM unnest(v_settings_ids) AS setting_id;
        END IF;
    END IF;

    RETURN QUERY
    SELECT v_department_id;
END;
$$;


