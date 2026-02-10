-- Patch document draft - accepts nested resource action composites.
-- Creates draft if input_draft_id is NULL, updates if exists.

DO $$
BEGIN
    DROP TYPE IF EXISTS types.document_resource_action CASCADE;
    CREATE TYPE types.document_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.document_multi_resource_action CASCADE;
    CREATE TYPE types.document_multi_resource_action AS (
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
        WHERE proname = 'api_patch_document_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_document_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_document_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.document_resource_action DEFAULT NULL,
    descriptions types.document_resource_action DEFAULT NULL,
    flags types.document_resource_action DEFAULT NULL,
    departments types.document_multi_resource_action DEFAULT NULL,
    fields types.document_multi_resource_action DEFAULT NULL,
    uploads types.document_multi_resource_action DEFAULT NULL,
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

    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_flag_id uuid;
    v_department_ids uuid[];
    v_field_ids uuid[];
    v_upload_ids uuid[];

    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_flag_id := (flags).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_field_ids := COALESCE((fields).resource_ids, ARRAY[]::uuid[]);
    v_upload_ids := COALESCE((uploads).resource_ids, ARRAY[]::uuid[]);

    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    -- Validate IDs
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_flag_id;
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_department_ids) AS did
        WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = did)
    ) THEN
        RAISE EXCEPTION 'One or more department_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_field_ids) AS fid
        WHERE NOT EXISTS (SELECT 1 FROM parameter_fields_resource WHERE field_id = fid)
    ) THEN
        RAISE EXCEPTION 'One or more field_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_upload_ids) AS uid
        WHERE NOT EXISTS (SELECT 1 FROM uploads_resource WHERE id = uid)
    ) THEN
        RAISE EXCEPTION 'One or more upload_ids not found';
    END IF;

    -- Try update path first
    IF input_draft_id IS NOT NULL THEN
        SELECT vde.group_id INTO v_group_id
        FROM view_drafts_entry vde
        WHERE vde.id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM view_sessions_entry
                 WHERE view_sessions_entry.profile_id = v_profile_id
                   AND view_sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE drafts_entry
        SET version = drafts_entry.version + 1,
            updated_at = NOW(),
            group_id = COALESCE(drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (
              SELECT 1
              FROM profiles_drafts_connection pdc
              WHERE pdc.draft_id = drafts_entry.id
                AND pdc.profiles_id = v_profiles_resource_id
          )
          AND drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
        END IF;
    END IF;

    -- Create path (new draft or failed optimistic update)
    IF v_draft_id IS NULL THEN
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (
                NOW(),
                NOW(),
                (SELECT id FROM view_sessions_entry
                 WHERE view_sessions_entry.profile_id = v_profile_id
                   AND view_sessions_entry.active = true
                 ORDER BY created_at DESC
                 LIMIT 1)
            )
            RETURNING id INTO v_group_id;
        END IF;

        INSERT INTO drafts_entry (artifact, group_id)
        VALUES ('document'::artifact_type, v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
    END IF;

    -- Replace draft links
    DELETE FROM names_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM descriptions_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM flags_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM departments_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM fields_drafts_connection WHERE draft_id = v_draft_id;
    DELETE FROM uploads_drafts_connection WHERE draft_id = v_draft_id;

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

    IF v_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE SET version = v_new_version;
    END IF;

    INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
    SELECT v_draft_id, did, v_new_version
    FROM UNNEST(v_department_ids) did
    ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO fields_drafts_connection (draft_id, fields_id, version)
    SELECT v_draft_id, fid, v_new_version
    FROM UNNEST(v_field_ids) fid
    ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE SET version = v_new_version;

    INSERT INTO uploads_drafts_connection (draft_id, uploads_id, version)
    SELECT v_draft_id, uid, v_new_version
    FROM UNNEST(v_upload_ids) uid
    ON CONFLICT ON CONSTRAINT uploads_draft_pkey DO UPDATE SET version = v_new_version;

    -- Tool-call tracking: one run per draft patch
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, v_group_id, NOW(), NOW());

        IF v_name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
            END IF;
        END IF;

        IF v_description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
            END IF;
        END IF;

        IF v_flag_id IS NOT NULL THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_flag_id, v_call_id);
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_flag_id, v_call_id);
            END IF;
        END IF;

        IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
            END IF;
        END IF;

        IF COALESCE(array_length(v_field_ids, 1), 0) > 0 THEN
            IF (fields).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((fields).create_tool_id, v_call_id);
                INSERT INTO fields_calls_connection (fields_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
            END IF;
            IF (fields).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((fields).link_tool_id, v_call_id);
                INSERT INTO fields_calls_connection (fields_id, call_id)
                SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
            END IF;
        END IF;

        IF COALESCE(array_length(v_upload_ids, 1), 0) > 0 THEN
            IF (uploads).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_create_uploads_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((uploads).create_tool_id, v_call_id);
                INSERT INTO uploads_calls_connection (uploads_id, call_id)
                SELECT uid, v_call_id FROM UNNEST(v_upload_ids) uid;
            END IF;
            IF (uploads).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'document_draft_link_uploads_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((uploads).link_tool_id, v_call_id);
                INSERT INTO uploads_calls_connection (uploads_id, call_id)
                SELECT uid, v_call_id FROM UNNEST(v_upload_ids) uid;
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END;
$$;
