-- Unified save setting function - section-action based.

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
    roles types.setting_multi_resource_action DEFAULT NULL,
    role_routes types.setting_multi_resource_action DEFAULT NULL
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
    v_role_route_ids uuid[];
BEGIN
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_color_ids := COALESCE((colors).resource_ids, ARRAY[]::uuid[]);
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_profile_ids := COALESCE((profiles).resource_ids, ARRAY[]::uuid[]);
    v_auth_ids := COALESCE((auths).resource_ids, ARRAY[]::uuid[]);
    v_provider_key_ids := COALESCE((provider_keys).resource_ids, ARRAY[]::uuid[]);
    v_auth_item_key_ids := COALESCE((auth_item_keys).resource_ids, ARRAY[]::uuid[]);
    v_role_ids := COALESCE((roles).resource_ids, ARRAY[]::uuid[]);
    v_role_route_ids := COALESCE((role_routes).resource_ids, ARRAY[]::uuid[]);
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

        DELETE FROM setting_names_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_descriptions_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_colors_junction WHERE setting_id = v_setting_id;
        DELETE FROM department_settings_junction WHERE settings_id = v_setting_id;
        DELETE FROM setting_profiles_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_auths_junction WHERE settings_id = v_setting_id;
        DELETE FROM setting_provider_keys_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_auth_item_keys_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_roles_junction WHERE setting_id = v_setting_id;
        DELETE FROM setting_role_routes_junction WHERE setting_id = v_setting_id;

        UPDATE setting_flags_junction
        SET flag_id = COALESCE(v_active_flag_id, setting_flags_junction.flag_id),
            value = CASE WHEN v_active_flag_id IS NOT NULL THEN true ELSE false END,
            active = true
        WHERE setting_id = v_setting_id;
    END IF;

    WITH params AS (
        SELECT
            v_setting_id AS setting_id,
            api_save_setting_v4.profile_id AS profile_id,
            v_name_id AS name_id,
            v_description_id AS description_id,
            v_active_flag_id AS active_flag_id,
            v_color_ids AS color_ids,
            v_department_ids AS department_ids,
            v_profile_ids AS profile_ids,
            v_auth_ids AS auth_ids,
            v_provider_key_ids AS provider_key_ids,
            v_auth_item_key_ids AS auth_item_key_ids,
            v_role_ids AS role_ids,
            v_role_route_ids AS role_route_ids
    ),
    object_current_departments AS (
        SELECT COALESCE(ARRAY_AGG(department_id::text), ARRAY[]::text[]) as department_ids
        FROM department_settings_junction
        WHERE department_settings_junction.settings_id = (SELECT p.setting_id FROM params p LIMIT 1) AND active = true
    ),
    validate_permissions AS (
        SELECT
            CASE
                WHEN (SELECT p.setting_id FROM params p) IS NULL THEN
                    (SELECT validate_department_create_permissions(
                        up.role::text,
                        x.department_ids::text[]
                    ) FROM params x CROSS JOIN user_profile up)
                ELSE
                    (SELECT validate_department_update_permissions(
                        up.role::text,
                        ocd.department_ids,
                        ud.department_ids
                    ) FROM user_profile up
                    CROSS JOIN object_current_departments ocd
                    CROSS JOIN user_departments ud)
            END as validation_passed
    ),
    link_setting_name AS (
        INSERT INTO setting_names_junction (setting_id, name_id, created_at)
        SELECT x.setting_id, x.name_id, NOW()
        FROM params x
        WHERE x.name_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_names_pkey DO NOTHING
    ),
    link_setting_description AS (
        INSERT INTO setting_descriptions_junction (setting_id, description_id, created_at)
        SELECT x.setting_id, x.description_id, NOW()
        FROM params x
        WHERE x.description_id IS NOT NULL
        ON CONFLICT ON CONSTRAINT setting_descriptions_pkey DO NOTHING
    ),
    link_colors AS (
        INSERT INTO setting_colors_junction (setting_id, color_id, type, created_at)
        SELECT x.setting_id, color_id, 'primary'::color_type, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.color_ids) as color_id
        WHERE COALESCE(array_length(x.color_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_colors_pkey DO NOTHING
    ),
    insert_setting_active_flag AS (
        INSERT INTO setting_flags_junction (setting_id, flag_id, value, created_at)
        SELECT x.setting_id,
            COALESCE(x.active_flag_id, f.id),
            CASE WHEN x.active_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM params x
        CROSS JOIN flags_resource f
        WHERE f.name = 'setting_active'
        ON CONFLICT ON CONSTRAINT setting_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, setting_flags_junction.flag_id),
            value = EXCLUDED.value,
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
        INSERT INTO setting_profiles_junction (setting_id, profile_id, active, created_at)
        SELECT x.setting_id, profile_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.profile_ids) as profile_id
        WHERE COALESCE(array_length(x.profile_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_profiles_pkey DO UPDATE SET
            active = true
    ),
    link_auths AS (
        INSERT INTO setting_auths_junction (settings_id, auth_id, active, created_at)
        SELECT x.setting_id, auth_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.auth_ids) as auth_id
        WHERE COALESCE(array_length(x.auth_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_auths_pkey DO UPDATE SET
            active = true
    ),
    link_provider_keys AS (
        INSERT INTO setting_provider_keys_junction (setting_id, provider_key_id, active, created_at)
        SELECT x.setting_id, provider_key_id, true, NOW()
        FROM params x
        CROSS JOIN UNNEST(x.provider_key_ids) as provider_key_id
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
    link_role_routes AS (
        INSERT INTO setting_role_routes_junction (setting_id, role_routes_id, active, created_at, updated_at)
        SELECT x.setting_id, role_routes_id, true, NOW(), NOW()
        FROM params x
        CROSS JOIN UNNEST(x.role_route_ids) as role_routes_id
        WHERE COALESCE(array_length(x.role_route_ids, 1), 0) > 0
        ON CONFLICT ON CONSTRAINT setting_role_routes_junction_pkey DO UPDATE SET
            active = true,
            updated_at = NOW()
    ),
    sync_artifact_resources AS (
        UPDATE settings_resource r
        SET name = n.name,
            description = d.description
        FROM setting_settings_junction j
        CROSS JOIN params p
        LEFT JOIN names_resource n ON n.id = p.name_id
        LEFT JOIN descriptions_resource d ON d.id = p.description_id
        WHERE j.settings_id = r.id
          AND j.setting_id = p.setting_id
        RETURNING r.id
    )
    SELECT 1;

    RETURN QUERY
    SELECT v_setting_id;
END;
$$;

