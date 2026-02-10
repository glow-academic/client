-- Patch provider draft - creates/updates draft resource links.

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
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    value_id uuid DEFAULT NULL,
    endpoint_id uuid DEFAULT NULL,
    key_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
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
BEGIN
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = api_patch_provider_draft_v4.profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', profile_id;
    END IF;

    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;
    IF value_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM values_resource WHERE id = value_id) THEN
        RAISE EXCEPTION 'Value resource not found: %', value_id;
    END IF;
    IF endpoint_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM endpoints_resource WHERE id = endpoint_id) THEN
        RAISE EXCEPTION 'Endpoint resource not found: %', endpoint_id;
    END IF;
    IF key_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM keys_resource WHERE id = key_id) THEN
        RAISE EXCEPTION 'Key resource not found: %', key_id;
    END IF;
    IF department_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1
            FROM UNNEST(department_ids) AS dept_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = dept_id)
        ) THEN
            RAISE EXCEPTION 'One or more department IDs not found';
        END IF;
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (
                    SELECT id
                    FROM view_sessions_entry
                    WHERE profile_id = api_patch_provider_draft_v4.profile_id
                      AND active = true
                    ORDER BY created_at DESC
                    LIMIT 1
                )
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET
            version = drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM profiles_drafts_connection pdj
              WHERE pdj.draft_id = drafts_entry.id
                AND pdj.profiles_id = v_profiles_resource_id
          )
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (
            NOW(),
            NOW(),
            (
                SELECT id
                FROM view_sessions_entry
                WHERE profile_id = api_patch_provider_draft_v4.profile_id
                  AND active = true
                ORDER BY created_at DESC
                LIMIT 1
            )
        )
        RETURNING id INTO v_group_id;

        INSERT INTO drafts_entry (artifact, group_id)
        VALUES ('provider'::artifact_type, v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    DELETE FROM names_drafts_connection WHERE names_drafts_connection.draft_id = v_draft_id;
    DELETE FROM descriptions_drafts_connection WHERE descriptions_drafts_connection.draft_id = v_draft_id;
    DELETE FROM flags_drafts_connection WHERE flags_drafts_connection.draft_id = v_draft_id;
    DELETE FROM values_drafts_connection WHERE values_drafts_connection.draft_id = v_draft_id;
    DELETE FROM endpoints_drafts_connection WHERE endpoints_drafts_connection.draft_id = v_draft_id;
    DELETE FROM keys_drafts_connection WHERE keys_drafts_connection.draft_id = v_draft_id;
    DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;

    IF name_id IS NOT NULL THEN
        INSERT INTO names_drafts_connection (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version);
    END IF;
    IF description_id IS NOT NULL THEN
        INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version);
    END IF;
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version);
    END IF;
    IF value_id IS NOT NULL THEN
        INSERT INTO values_drafts_connection (draft_id, values_id, version)
        VALUES (v_draft_id, value_id, v_new_version);
    END IF;
    IF endpoint_id IS NOT NULL THEN
        INSERT INTO endpoints_drafts_connection (draft_id, endpoints_id, version)
        VALUES (v_draft_id, endpoint_id, v_new_version);
    END IF;
    IF key_id IS NOT NULL THEN
        INSERT INTO keys_drafts_connection (draft_id, keys_id, version)
        VALUES (v_draft_id, key_id, v_new_version);
    END IF;
    IF department_ids IS NOT NULL THEN
        INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) AS dept_id;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
