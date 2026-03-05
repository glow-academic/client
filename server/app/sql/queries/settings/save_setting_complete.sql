-- Unified save setting function - section-action based.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.setting_resource_action CASCADE;
    CREATE TYPE types.setting_resource_action AS (
        resources_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.setting_multi_resource_action CASCADE;
    CREATE TYPE types.setting_multi_resource_action AS (
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
        WHERE proname = 'api_save_setting_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_setting_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_save_setting_v4(
    profile_id uuid,
    group_id uuid DEFAULT NULL,
    input_setting_id uuid DEFAULT NULL,
    names types.setting_resource_action DEFAULT NULL,
    descriptions types.setting_resource_action DEFAULT NULL,
    colors types.setting_multi_resource_action DEFAULT NULL,
    flags types.setting_resource_action DEFAULT NULL,
    departments types.setting_multi_resource_action DEFAULT NULL,
    profiles types.setting_multi_resource_action DEFAULT NULL,
    auths types.setting_multi_resource_action DEFAULT NULL,
    provider_keys types.setting_multi_resource_action DEFAULT NULL,
    auth_item_keys types.setting_multi_resource_action DEFAULT NULL,
    roles types.setting_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    setting_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_setting_id uuid;
    is_create boolean;
    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_color_ids uuid[];
    v_department_ids uuid[];
    v_profile_ids uuid[];
    v_auth_ids uuid[];
    v_provider_key_ids uuid[];
    v_auth_item_key_ids uuid[];
    v_role_ids uuid[];
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resources_id;
    v_description_id := (descriptions).resources_id;
    v_active_flag_id := (flags).resources_id;
    v_color_ids := COALESCE((colors).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_profile_ids := COALESCE((profiles).resource_ids, ARRAY[]::uuid[]);
    v_auth_ids := COALESCE((auths).resource_ids, ARRAY[]::uuid[]);
    v_provider_key_ids := COALESCE((provider_keys).resource_ids, ARRAY[]::uuid[]);
    v_auth_item_key_ids := COALESCE((auth_item_keys).resource_ids, ARRAY[]::uuid[]);
    v_role_ids := COALESCE((roles).resource_ids, ARRAY[]::uuid[]);
    is_create := (input_setting_id IS NULL);

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'Name resource is required';
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

    IF is_create THEN
        INSERT INTO setting_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_setting_id;
    ELSE
        v_setting_id := input_setting_id;
        UPDATE setting_artifact
        SET updated_at = NOW()
        WHERE id = v_setting_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Setting not found: %', input_setting_id;
        END IF;

        UPDATE setting_names_junction SET active = false WHERE setting_names_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_descriptions_junction SET active = false WHERE setting_descriptions_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_colors_junction SET active = false WHERE setting_colors_junction.setting_id = v_setting_id AND active = true;
        UPDATE department_settings_junction SET active = false WHERE department_settings_junction.settings_id = v_setting_id AND active = true;
        UPDATE setting_profiles_junction SET active = false WHERE setting_profiles_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_auths_junction SET active = false WHERE setting_auths_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_provider_keys_junction SET active = false WHERE setting_provider_keys_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_auth_item_keys_junction SET active = false WHERE setting_auth_item_keys_junction.setting_id = v_setting_id AND active = true;
        UPDATE setting_roles_junction SET active = false WHERE setting_roles_junction.setting_id = v_setting_id AND active = true;

        UPDATE setting_flags_junction
        SET flags_id = COALESCE(v_active_flag_id, setting_flags_junction.flags_id),
            active = true
        WHERE setting_flags_junction.setting_id = v_setting_id;
    END IF;

    -- === TOOL CALL TRACKING ===
    -- Create single run for the group if any tool IDs present
    IF group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, group_id, NOW(), NOW());
    END IF;

    -- names (single-select)
    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_names_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions (single-select)
    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_descriptions_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- flags (single-select)
    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_flags_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    -- colors (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_color_ids, 1), 0) > 0 THEN
        IF (colors).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_colors_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id)
            SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
        END IF;
        IF (colors).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_colors_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id)
            SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
        END IF;
    END IF;

    -- departments (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_departments_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    -- profiles (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_profile_ids, 1), 0) > 0 THEN
        IF (profiles).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_profiles_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).create_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
        END IF;
        IF (profiles).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_profiles_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).link_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
        END IF;
    END IF;

    -- auths (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_ids, 1), 0) > 0 THEN
        IF (auths).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_auths_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).create_tool_id, v_call_id);
            INSERT INTO auths_calls_connection (auths_id, call_id)
            SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
        END IF;
        IF (auths).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_auths_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).link_tool_id, v_call_id);
            INSERT INTO auths_calls_connection (auths_id, call_id)
            SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
        END IF;
    END IF;

    -- provider_keys (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_provider_key_ids, 1), 0) > 0 THEN
        IF (provider_keys).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_provider_keys_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).create_tool_id, v_call_id);
            INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
            SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
        END IF;
        IF (provider_keys).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_provider_keys_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).link_tool_id, v_call_id);
            INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
            SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
        END IF;
    END IF;

    -- auth_item_keys (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_item_key_ids, 1), 0) > 0 THEN
        IF (auth_item_keys).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_auth_item_keys_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).create_tool_id, v_call_id);
            INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
            SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
        END IF;
        IF (auth_item_keys).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_auth_item_keys_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).link_tool_id, v_call_id);
            INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
            SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
        END IF;
    END IF;

    -- roles (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_role_ids, 1), 0) > 0 THEN
        IF (roles).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_create_roles_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).create_tool_id, v_call_id);
            INSERT INTO roles_calls_connection (roles_id, call_id)
            SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
        END IF;
        IF (roles).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
            VALUES (v_call_id, 'setting_link_roles_' || v_call_id::text, v_run_id, NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).link_tool_id, v_call_id);
            INSERT INTO roles_calls_connection (roles_id, call_id)
            SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
        END IF;
    END IF;

    RETURN QUERY
    WITH params AS (
        SELECT
            v_setting_id AS setting_id,
            api_save_setting_v4.profile_id AS profile_id,
            v_name_id AS names_id,
            v_description_id AS descriptions_id,
            v_active_flag_id AS active_flag_id,
            v_color_ids AS color_ids,
            v_department_ids AS department_ids,
            v_profile_ids AS profile_ids,
            v_auth_ids AS auth_ids,
            v_provider_key_ids AS provider_key_ids,
            v_auth_item_key_ids AS auth_item_key_ids,
            v_role_ids AS role_ids
    ),
    -- NOTE: Department permission validation is handled in Python (save.py)
    -- via compute_can_edit() before this SQL function is called.
    link_setting_name AS (
        INSERT INTO setting_names_junction (setting_id, names_id, active, created_at)
        SELECT x.setting_id, x.names_id, true, NOW()
        FROM params x
        WHERE x.names_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_names_pkey DO UPDATE SET
            active = true
    ),
    link_setting_description AS (
        INSERT INTO setting_descriptions_junction (setting_id, descriptions_id, active, created_at)
        SELECT x.setting_id, x.descriptions_id, true, NOW()
        FROM params x
        WHERE x.descriptions_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_descriptions_pkey DO UPDATE SET
            active = true
    ),
    link_colors AS (
        INSERT INTO setting_colors_junction (setting_id, colors_id, active, created_at)
        SELECT x.setting_id, color_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.color_ids) as color_id
        WHERE COALESCE(array_length(x.color_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_colors_pkey DO UPDATE SET
            active = true
    ),
    insert_setting_active_flag AS (
        INSERT INTO setting_flags_junction (setting_id, flags_id, created_at)
        SELECT x.setting_id,
            COALESCE(x.active_flag_id, f.id),
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'setting_active'
        ON CONFLICT ON CONSTRAINT setting_flags_pkey DO UPDATE SET
            flags_id = COALESCE(EXCLUDED.flags_id, setting_flags_junction.flags_id),
            active = true
    ),
    link_departments AS (
        INSERT INTO department_settings_junction (settings_id, department_id, active, created_at)
        SELECT x.setting_id, dept_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.department_ids) as dept_id
        WHERE COALESCE(array_length(x.department_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT department_settings_pkey DO UPDATE SET
            active = true
    ),
    link_profiles AS (
        INSERT INTO setting_profiles_junction (setting_id, profiles_id, active, created_at)
        SELECT x.setting_id, pid, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.profile_ids) as pid
        WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_profiles_pkey DO UPDATE SET
            active = true
    ),
    link_auths AS (
        INSERT INTO setting_auths_junction (setting_id, auths_id, active, created_at)
        SELECT x.setting_id, auth_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.auth_ids) as auth_id
        WHERE COALESCE(array_length(x.auth_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_auths_pkey DO UPDATE SET
            active = true
    ),
    link_provider_keys AS (
        INSERT INTO setting_provider_keys_junction (setting_id, provider_keys_id, active, created_at)
        SELECT x.setting_id, provider_keys_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.provider_key_ids) as provider_keys_id
        WHERE COALESCE(array_length(x.provider_key_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_provider_keys_junction_pkey DO UPDATE SET
            active = true
    ),
    link_auth_item_keys AS (
        INSERT INTO setting_auth_item_keys_junction (setting_id, auth_item_keys_id, active, created_at)
        SELECT x.setting_id, auth_item_keys_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.auth_item_key_ids) as auth_item_keys_id
        WHERE COALESCE(array_length(x.auth_item_key_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_auth_item_keys_junction_pkey DO UPDATE SET
            active = true
    ),
    sync_provider_key_ids AS (
        UPDATE settings_resource sr
        SET provider_key_ids = x.provider_key_ids
        FROM params x
        JOIN setting_settings_junction ssj ON ssj.setting_id = x.setting_id AND ssj.active = true
        WHERE sr.id = ssj.settings_id
        RETURNING sr.id
    ),
    link_roles AS (
        INSERT INTO setting_roles_junction (setting_id, role_id, active, created_at)
        SELECT x.setting_id, role_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.role_ids) as role_id
        WHERE COALESCE(array_length(x.role_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_roles_junction_pkey DO UPDATE SET
            active = true
    ),
    sync_artifact_resources AS (
        UPDATE settings_resource r
        SET name = n.name,
            description = d.description
        FROM setting_settings_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.names_id
        LEFT JOIN descriptions_resource d ON d.id = p.descriptions_id
        WHERE j.settings_id = r.id
          AND j.setting_id = p.setting_id
        RETURNING r.id
    )
    SELECT v_setting_id;
END;
$$;

