-- Patch setting draft - section-action contract.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.setting_resource_action CASCADE;
    CREATE TYPE types.setting_resource_action AS (
        resource_id uuid,
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
        WHERE proname = 'api_patch_setting_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_setting_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_setting_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.setting_resource_action DEFAULT NULL,
    descriptions types.setting_resource_action DEFAULT NULL,
    flags types.setting_resource_action DEFAULT NULL,
    colors types.setting_multi_resource_action DEFAULT NULL,
    departments types.setting_multi_resource_action DEFAULT NULL,
    profiles types.setting_multi_resource_action DEFAULT NULL,
    auths types.setting_multi_resource_action DEFAULT NULL,
    provider_keys types.setting_multi_resource_action DEFAULT NULL,
    auth_item_keys types.setting_multi_resource_action DEFAULT NULL,
    roles types.setting_multi_resource_action DEFAULT NULL,
    role_routes types.setting_multi_resource_action DEFAULT NULL,
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
    v_profile_id uuid := profile_id;  -- This is profile_artifact.id
    v_profiles_resource_id uuid;      -- This is profiles_resource.id (for FK)
    v_group_id uuid;
    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_color_ids uuid[] := COALESCE((colors).resource_ids, ARRAY[]::uuid[]);
    v_department_ids uuid[] := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_profile_ids uuid[] := COALESCE((profiles).resource_ids, ARRAY[]::uuid[]);
    v_auth_ids uuid[] := COALESCE((auths).resource_ids, ARRAY[]::uuid[]);
    v_provider_key_ids uuid[] := COALESCE((provider_keys).resource_ids, ARRAY[]::uuid[]);
    v_auth_item_key_ids uuid[] := COALESCE((auth_item_keys).resource_ids, ARRAY[]::uuid[]);
    v_role_ids uuid[] := COALESCE((roles).resource_ids, ARRAY[]::uuid[]);
    v_role_route_ids uuid[] := COALESCE((role_routes).resource_ids, ARRAY[]::uuid[]);
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    -- profiles_drafts_connection has FK to profiles_resource, not profile_artifact
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
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

    IF COALESCE(array_length(v_profile_ids, 1), 0) > 0 AND EXISTS (
        SELECT 1
        FROM UNNEST(v_profile_ids) as pid
        WHERE NOT EXISTS (SELECT 1 FROM profile_artifact WHERE id = pid)
    ) THEN
        RAISE EXCEPTION 'Profile resource not found in profile_artifact';
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT drafts_entry.group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;

        IF v_group_id IS NULL THEN
            v_group_id := group_id;
        END IF;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM profiles_drafts_connection pdj WHERE pdj.draft_id = drafts_entry.id AND pdj.profiles_id = v_profiles_resource_id)
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- === TOOL CALL TRACKING (update path) ===
            IF v_group_id IS NOT NULL THEN
                v_run_id := uuidv7();
                INSERT INTO runs_entry (id, group_id, created_at, updated_at)
                VALUES (v_run_id, v_group_id, NOW(), NOW());
            END IF;

            IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
                IF (names).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;
                IF (names).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
                IF (descriptions).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;
                IF (descriptions).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
                IF (flags).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;
                IF (flags).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_color_ids, 1), 0) > 0 THEN
                IF (colors).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
                    INSERT INTO colors_calls_connection (colors_id, call_id)
                    SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
                END IF;
                IF (colors).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
                    INSERT INTO colors_calls_connection (colors_id, call_id)
                    SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
                IF (departments).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
                END IF;
                IF (departments).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_profile_ids, 1), 0) > 0 THEN
                IF (profiles).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).create_tool_id, v_call_id);
                    INSERT INTO profiles_calls_connection (profiles_id, call_id)
                    SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
                END IF;
                IF (profiles).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).link_tool_id, v_call_id);
                    INSERT INTO profiles_calls_connection (profiles_id, call_id)
                    SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_ids, 1), 0) > 0 THEN
                IF (auths).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_auths_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).create_tool_id, v_call_id);
                    INSERT INTO auths_calls_connection (auths_id, call_id)
                    SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
                END IF;
                IF (auths).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_auths_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).link_tool_id, v_call_id);
                    INSERT INTO auths_calls_connection (auths_id, call_id)
                    SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_provider_key_ids, 1), 0) > 0 THEN
                IF (provider_keys).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_provider_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).create_tool_id, v_call_id);
                    INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
                    SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
                END IF;
                IF (provider_keys).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_provider_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).link_tool_id, v_call_id);
                    INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
                    SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_item_key_ids, 1), 0) > 0 THEN
                IF (auth_item_keys).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_auth_item_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).create_tool_id, v_call_id);
                    INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
                    SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
                END IF;
                IF (auth_item_keys).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_auth_item_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).link_tool_id, v_call_id);
                    INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
                    SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_role_ids, 1), 0) > 0 THEN
                IF (roles).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_roles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).create_tool_id, v_call_id);
                    INSERT INTO roles_calls_connection (roles_id, call_id)
                    SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
                END IF;
                IF (roles).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_roles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).link_tool_id, v_call_id);
                    INSERT INTO roles_calls_connection (roles_id, call_id)
                    SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
                END IF;
            END IF;

            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_role_route_ids, 1), 0) > 0 THEN
                IF (role_routes).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_create_role_routes_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((role_routes).create_tool_id, v_call_id);
                    INSERT INTO role_routes_calls_connection (role_routes_id, call_id)
                    SELECT rr_id, v_call_id FROM UNNEST(v_role_route_ids) AS rr_id;
                END IF;
                IF (role_routes).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'setting_draft_link_role_routes_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((role_routes).link_tool_id, v_call_id);
                    INSERT INTO role_routes_calls_connection (role_routes_id, call_id)
                    SELECT rr_id, v_call_id FROM UNNEST(v_role_route_ids) AS rr_id;
                END IF;
            END IF;

            DELETE FROM names_drafts_connection WHERE names_drafts_connection.draft_id = v_draft_id;
            DELETE FROM descriptions_drafts_connection WHERE descriptions_drafts_connection.draft_id = v_draft_id;
            DELETE FROM colors_drafts_connection WHERE colors_drafts_connection.draft_id = v_draft_id;
            DELETE FROM flags_drafts_connection WHERE flags_drafts_connection.draft_id = v_draft_id;
            DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;
            DELETE FROM profiles_drafts_connection WHERE profiles_drafts_connection.draft_id = v_draft_id;
            DELETE FROM providers_drafts_connection WHERE providers_drafts_connection.draft_id = v_draft_id;
            DELETE FROM keys_drafts_connection WHERE keys_drafts_connection.draft_id = v_draft_id;
            DELETE FROM roles_drafts_connection WHERE roles_drafts_connection.draft_id = v_draft_id;
            DELETE FROM role_routes_drafts_connection WHERE role_routes_drafts_connection.draft_id = v_draft_id;

            INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
            VALUES (v_draft_id, v_profiles_resource_id, v_new_version)
            ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE SET version = v_new_version;

            IF v_name_id IS NOT NULL THEN
                INSERT INTO names_drafts_connection (draft_id, names_id, version)
                VALUES (v_draft_id, v_name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_description_id IS NOT NULL THEN
                INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
                VALUES (v_draft_id, v_description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_active_flag_id IS NOT NULL THEN
                INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, v_active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_color_ids, 1), 0) > 0 THEN
                INSERT INTO colors_drafts_connection (draft_id, colors_id, version)
                SELECT v_draft_id, color_id, v_new_version
                FROM UNNEST(v_color_ids) as color_id
                ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
                INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(v_department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_profile_ids, 1), 0) > 0 THEN
                INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
                SELECT v_draft_id, profile_id, v_new_version
                FROM UNNEST(v_profile_ids) as profile_id
                ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_provider_key_ids, 1), 0) > 0 THEN
                INSERT INTO providers_drafts_connection (draft_id, providers_id, version)
                SELECT v_draft_id, provider_id, v_new_version
                FROM UNNEST(v_provider_key_ids) as provider_id
                ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_auth_item_key_ids, 1), 0) > 0 THEN
                INSERT INTO keys_drafts_connection (draft_id, keys_id, version)
                SELECT v_draft_id, key_id, v_new_version
                FROM UNNEST(v_auth_item_key_ids) as key_id
                ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_role_ids, 1), 0) > 0 THEN
                INSERT INTO roles_drafts_connection (draft_id, roles_id, version)
                SELECT v_draft_id, role_id, v_new_version
                FROM UNNEST(v_role_ids) as role_id
                ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF COALESCE(array_length(v_role_route_ids, 1), 0) > 0 THEN
                INSERT INTO role_routes_drafts_connection (draft_id, role_routes_id, version)
                SELECT v_draft_id, rr_id, v_new_version
                FROM UNNEST(v_role_route_ids) as rr_id
                ON CONFLICT ON CONSTRAINT role_routes_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    v_group_id := group_id;
    IF v_group_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (
            NOW(),
            NOW(),
            (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
        )
        RETURNING id INTO v_group_id;
    END IF;

    INSERT INTO drafts_entry (artifact, group_id)
    VALUES ('setting'::artifact_type, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- === TOOL CALL TRACKING (create path) ===
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());
    END IF;

    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_color_ids, 1), 0) > 0 THEN
        IF (colors).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id)
            SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
        END IF;
        IF (colors).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id)
            SELECT color_id, v_call_id FROM UNNEST(v_color_ids) AS color_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_profile_ids, 1), 0) > 0 THEN
        IF (profiles).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).create_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
        END IF;
        IF (profiles).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_profiles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((profiles).link_tool_id, v_call_id);
            INSERT INTO profiles_calls_connection (profiles_id, call_id)
            SELECT prof_id, v_call_id FROM UNNEST(v_profile_ids) AS prof_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_ids, 1), 0) > 0 THEN
        IF (auths).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_auths_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).create_tool_id, v_call_id);
            INSERT INTO auths_calls_connection (auths_id, call_id)
            SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
        END IF;
        IF (auths).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_auths_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auths).link_tool_id, v_call_id);
            INSERT INTO auths_calls_connection (auths_id, call_id)
            SELECT auth_id, v_call_id FROM UNNEST(v_auth_ids) AS auth_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_provider_key_ids, 1), 0) > 0 THEN
        IF (provider_keys).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_provider_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).create_tool_id, v_call_id);
            INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
            SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
        END IF;
        IF (provider_keys).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_provider_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((provider_keys).link_tool_id, v_call_id);
            INSERT INTO provider_keys_calls_connection (provider_keys_id, call_id)
            SELECT pk_id, v_call_id FROM UNNEST(v_provider_key_ids) AS pk_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_auth_item_key_ids, 1), 0) > 0 THEN
        IF (auth_item_keys).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_auth_item_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).create_tool_id, v_call_id);
            INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
            SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
        END IF;
        IF (auth_item_keys).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_auth_item_keys_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((auth_item_keys).link_tool_id, v_call_id);
            INSERT INTO auth_item_keys_calls_connection (auth_item_keys_id, call_id)
            SELECT aik_id, v_call_id FROM UNNEST(v_auth_item_key_ids) AS aik_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_role_ids, 1), 0) > 0 THEN
        IF (roles).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_roles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).create_tool_id, v_call_id);
            INSERT INTO roles_calls_connection (roles_id, call_id)
            SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
        END IF;
        IF (roles).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_roles_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((roles).link_tool_id, v_call_id);
            INSERT INTO roles_calls_connection (roles_id, call_id)
            SELECT role_id, v_call_id FROM UNNEST(v_role_ids) AS role_id;
        END IF;
    END IF;

    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_role_route_ids, 1), 0) > 0 THEN
        IF (role_routes).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_create_role_routes_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((role_routes).create_tool_id, v_call_id);
            INSERT INTO role_routes_calls_connection (role_routes_id, call_id)
            SELECT rr_id, v_call_id FROM UNNEST(v_role_route_ids) AS rr_id;
        END IF;
        IF (role_routes).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'setting_draft_link_role_routes_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((role_routes).link_tool_id, v_call_id);
            INSERT INTO role_routes_calls_connection (role_routes_id, call_id)
            SELECT rr_id, v_call_id FROM UNNEST(v_role_route_ids) AS rr_id;
        END IF;
    END IF;

    INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profiles_resource_id, v_new_version)
    ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE SET version = v_new_version;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO names_drafts_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_color_ids, 1), 0) > 0 THEN
        INSERT INTO colors_drafts_connection (draft_id, colors_id, version)
        SELECT v_draft_id, color_id, v_new_version
        FROM UNNEST(v_color_ids) as color_id
        ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(v_department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_profile_ids, 1), 0) > 0 THEN
        INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
        SELECT v_draft_id, profile_id, v_new_version
        FROM UNNEST(v_profile_ids) as profile_id
        ON CONFLICT ON CONSTRAINT profiles_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_provider_key_ids, 1), 0) > 0 THEN
        INSERT INTO providers_drafts_connection (draft_id, providers_id, version)
        SELECT v_draft_id, provider_id, v_new_version
        FROM UNNEST(v_provider_key_ids) as provider_id
        ON CONFLICT ON CONSTRAINT providers_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_auth_item_key_ids, 1), 0) > 0 THEN
        INSERT INTO keys_drafts_connection (draft_id, keys_id, version)
        SELECT v_draft_id, key_id, v_new_version
        FROM UNNEST(v_auth_item_key_ids) as key_id
        ON CONFLICT ON CONSTRAINT keys_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_role_ids, 1), 0) > 0 THEN
        INSERT INTO roles_drafts_connection (draft_id, roles_id, version)
        SELECT v_draft_id, role_id, v_new_version
        FROM UNNEST(v_role_ids) as role_id
        ON CONFLICT ON CONSTRAINT roles_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF COALESCE(array_length(v_role_route_ids, 1), 0) > 0 THEN
        INSERT INTO role_routes_drafts_connection (draft_id, role_routes_id, version)
        SELECT v_draft_id, rr_id, v_new_version
        FROM UNNEST(v_role_route_ids) as rr_id
        ON CONFLICT ON CONSTRAINT role_routes_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
