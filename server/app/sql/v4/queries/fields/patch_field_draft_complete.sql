-- Patch field draft - accepts nested resource action composites.
-- Creates draft if input_draft_id is NULL, updates if exists.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.field_resource_action CASCADE;
    CREATE TYPE types.field_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.field_multi_resource_action CASCADE;
    CREATE TYPE types.field_multi_resource_action AS (
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
        WHERE proname = 'api_patch_field_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_field_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_field_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.field_resource_action DEFAULT NULL,
    descriptions types.field_resource_action DEFAULT NULL,
    flags types.field_resource_action DEFAULT NULL,
    departments types.field_multi_resource_action DEFAULT NULL,
    conditional_parameters types.field_multi_resource_action DEFAULT NULL,
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
    v_profiles_resource_id uuid;
    v_group_id uuid := group_id;

    v_name_id uuid;
    v_description_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_conditional_parameter_ids uuid[];

    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_conditional_parameter_ids := COALESCE((conditional_parameters).resource_ids, ARRAY[]::uuid[]);

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

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_conditional_parameter_ids) AS pid
        WHERE NOT EXISTS (SELECT 1 FROM parameters_resource WHERE id = pid)
    ) THEN
        RAISE EXCEPTION 'One or more conditional_parameter_ids not found';
    END IF;

    IF input_draft_id IS NOT NULL THEN
        SELECT vde.group_id INTO v_group_id
        FROM field_drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM sessions_entry
                 WHERE sessions_entry.profile_id = v_profile_id
                   AND sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE field_drafts_entry
        SET version = field_drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(field_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM field_drafts_profiles_connection pdc
              WHERE pdc.draft_id = field_drafts_entry.id
                AND pdc.profiles_id = v_profiles_resource_id
          )
          AND field_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM sessions_entry
                 WHERE sessions_entry.profile_id = v_profile_id
                   AND sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO field_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO field_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    DELETE FROM field_drafts_names_connection WHERE draft_id = v_draft_id;
    DELETE FROM field_drafts_descriptions_connection WHERE draft_id = v_draft_id;
    DELETE FROM field_drafts_flags_connection WHERE draft_id = v_draft_id;
    DELETE FROM field_drafts_departments_connection WHERE draft_id = v_draft_id;
    DELETE FROM field_drafts_parameters_connection WHERE draft_id = v_draft_id;

    IF v_name_id IS NOT NULL THEN
        INSERT INTO field_drafts_names_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO field_drafts_descriptions_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO field_drafts_flags_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    INSERT INTO field_drafts_departments_connection (draft_id, departments_id, version)
    SELECT v_draft_id, did, v_new_version
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO field_drafts_parameters_connection (draft_id, parameters_id, version)
    SELECT v_draft_id, pid, v_new_version
    FROM UNNEST(v_conditional_parameter_ids) pid
    ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE SET version = v_new_version;

    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, group_id, created_at, updated_at)
        VALUES (v_run_id, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_create_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_link_names_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
        END IF;

        IF v_description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_create_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_link_descriptions_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
        END IF;

        IF v_active_flag_id IS NOT NULL THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_create_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_link_flags_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
            END IF;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_create_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_link_departments_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
        END IF;

        IF COALESCE(array_length(v_conditional_parameter_ids, 1), 0) > 0 THEN
            IF (conditional_parameters).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_create_conditional_parameters_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((conditional_parameters).create_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT pid, v_call_id FROM UNNEST(v_conditional_parameter_ids) pid;
            END IF;
            IF (conditional_parameters).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, created_at)
                VALUES (v_call_id, 'field_draft_link_conditional_parameters_' || v_call_id::text, v_run_id, NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((conditional_parameters).link_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT pid, v_call_id FROM UNNEST(v_conditional_parameter_ids) pid;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
