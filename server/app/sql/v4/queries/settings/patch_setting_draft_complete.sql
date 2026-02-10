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
    auth_keys types.setting_multi_resource_action DEFAULT NULL,
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
    v_profile_id uuid := profile_id;
    v_group_id uuid;
    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_color_ids uuid[] := COALESCE((colors).resource_ids, ARRAY[]::uuid[]);
    v_department_ids uuid[] := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_profile_ids uuid[] := COALESCE((profiles).resource_ids, ARRAY[]::uuid[]);
    v_auth_ids uuid[] := COALESCE((auths).resource_ids, ARRAY[]::uuid[]);
    v_provider_key_ids uuid[] := COALESCE((provider_keys).resource_ids, ARRAY[]::uuid[]);
    v_auth_key_ids uuid[] := COALESCE((auth_keys).resource_ids, ARRAY[]::uuid[]);
    v_role_ids uuid[] := COALESCE((roles).resource_ids, ARRAY[]::uuid[]);
    v_role_route_ids uuid[] := COALESCE((role_routes).resource_ids, ARRAY[]::uuid[]);
BEGIN
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
        SELECT group_id INTO v_group_id FROM view_drafts_entry WHERE id = input_draft_id;

        IF v_group_id IS NULL THEN
            v_group_id := group_id;
        END IF;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM profiles_drafts_connection pdj WHERE pdj.draft_id = drafts_entry.id AND pdj.profiles_id = v_profile_id)
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            DELETE FROM names_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM descriptions_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM colors_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM flags_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM departments_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM profiles_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM providers_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM keys_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM roles_drafts_connection WHERE draft_id = v_draft_id;
            DELETE FROM role_routes_drafts_connection WHERE draft_id = v_draft_id;

            INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
            VALUES (v_draft_id, v_profile_id, v_new_version)
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

            IF COALESCE(array_length(v_auth_key_ids, 1), 0) > 0 THEN
                INSERT INTO keys_drafts_connection (draft_id, keys_id, version)
                SELECT v_draft_id, key_id, v_new_version
                FROM UNNEST(v_auth_key_ids) as key_id
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
            (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1)
        )
        RETURNING id INTO v_group_id;
    END IF;

    INSERT INTO drafts_entry (artifact, group_id)
    VALUES ('setting'::artifact_type, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profile_id, v_new_version)
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

    IF COALESCE(array_length(v_auth_key_ids, 1), 0) > 0 THEN
        INSERT INTO keys_drafts_connection (draft_id, keys_id, version)
        SELECT v_draft_id, key_id, v_new_version
        FROM UNNEST(v_auth_key_ids) as key_id
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
