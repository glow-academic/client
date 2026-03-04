-- Patch provider draft - section-action contract (persona parity).

DO $$
BEGIN
    DROP TYPE IF EXISTS types.provider_resource_action CASCADE;
    CREATE TYPE types.provider_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.provider_multi_resource_action CASCADE;
    CREATE TYPE types.provider_multi_resource_action AS (
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
        WHERE proname = 'api_patch_provider_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_provider_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_provider_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.provider_resource_action DEFAULT NULL,
    descriptions types.provider_resource_action DEFAULT NULL,
    flags types.provider_resource_action DEFAULT NULL,
    departments types.provider_multi_resource_action DEFAULT NULL,
    values_action types.provider_resource_action DEFAULT NULL,
    endpoints types.provider_resource_action DEFAULT NULL,
    keys types.provider_resource_action DEFAULT NULL,
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
    v_name_id uuid := (names).resource_id;
    v_description_id uuid := (descriptions).resource_id;
    v_active_flag_id uuid := (flags).resource_id;
    v_value_id uuid := (values_action).resource_id;
    v_endpoint_id uuid := (endpoints).resource_id;
    v_key_id uuid := (keys).resource_id;
    v_department_ids uuid[] := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
BEGIN
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = api_patch_provider_draft_v4.profile_id
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
    IF v_value_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM values_resource WHERE id = v_value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', v_value_id;
    END IF;
    IF v_endpoint_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM endpoints_resource WHERE id = v_endpoint_id) THEN
        RAISE EXCEPTION 'Endpoint resource not found: %', v_endpoint_id;
    END IF;
    IF v_key_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM keys_resource WHERE id = v_key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', v_key_id;
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF EXISTS (
            SELECT 1
            FROM UNNEST(v_department_ids) AS dept_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = dept_id)
        ) THEN
            RAISE EXCEPTION 'One or more department IDs not found';
        END IF;
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT d.group_id INTO v_group_id
        FROM provider_drafts_entry d
        WHERE d.id = input_draft_id;

        IF v_group_id IS NULL THEN
            v_group_id := group_id;
        END IF;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, session_id)
            VALUES (
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE profile_id = api_patch_provider_draft_v4.profile_id
                      AND active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE provider_drafts_entry
        SET
            version = provider_drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(provider_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM provider_drafts_profiles_connection pdj
              WHERE pdj.draft_id = provider_drafts_entry.id
                AND pdj.profiles_id = v_profiles_resource_id
          )
          AND provider_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        v_group_id := group_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, session_id)
            VALUES (
                NOW(),
                (
                    SELECT id
                    FROM sessions_entry
                    WHERE profile_id = api_patch_provider_draft_v4.profile_id
                      AND active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO provider_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO provider_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    DELETE FROM provider_drafts_names_connection WHERE provider_drafts_names_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_descriptions_connection WHERE provider_drafts_descriptions_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_flags_connection WHERE provider_drafts_flags_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_values_connection WHERE provider_drafts_values_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_endpoints_connection WHERE provider_drafts_endpoints_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_keys_connection WHERE provider_drafts_keys_connection.draft_id = v_draft_id;
    DELETE FROM provider_drafts_departments_connection WHERE provider_drafts_departments_connection.draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO provider_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version);
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO provider_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version);
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO provider_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version);
    END IF;

    IF v_value_id IS NOT NULL THEN
        INSERT INTO provider_drafts_values_connection (draft_id, values_id, version)
        VALUES (v_draft_id, v_value_id, v_new_version);
    END IF;

    IF v_endpoint_id IS NOT NULL THEN
        INSERT INTO provider_drafts_endpoints_connection (draft_id, endpoints_id, version)
        VALUES (v_draft_id, v_endpoint_id, v_new_version);
    END IF;

    IF v_key_id IS NOT NULL THEN
        INSERT INTO provider_drafts_keys_connection (draft_id, keys_id, version)
        VALUES (v_draft_id, v_key_id, v_new_version);
    END IF;

    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        INSERT INTO provider_drafts_departments_connection (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(v_department_ids) AS dept_id;
    END IF;

    RETURN QUERY
    SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
