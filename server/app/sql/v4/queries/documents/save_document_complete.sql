-- Unified save document function - handles both create (document_id = NULL) and update (document_id provided)
-- Uses nested resource action composites with tool call tracking.

-- 0) Drop and recreate composite types for resource actions
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

-- 1) Drop function first (breaks dependency on types)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_document_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_document_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Recreate function with composite resource action parameters
CREATE OR REPLACE FUNCTION api_save_document_v4(
    profile_id uuid,
    input_document_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.document_resource_action DEFAULT NULL,
    descriptions types.document_resource_action DEFAULT NULL,
    flags types.document_resource_action DEFAULT NULL,
    departments types.document_multi_resource_action DEFAULT NULL,
    fields types.document_multi_resource_action DEFAULT NULL,
    uploads types.document_multi_resource_action DEFAULT NULL,
    images types.document_multi_resource_action DEFAULT NULL,
    texts types.document_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    document_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_document_id uuid;
    v_profile_id uuid;
    v_input_document_id uuid;
    v_group_id uuid;
    is_create boolean;

    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_flag_id uuid;
    v_department_ids uuid[];
    v_field_ids uuid[];
    v_upload_ids uuid[];
    v_image_ids uuid[];
    v_text_ids uuid[];

    -- Call tracking
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    v_profile_id := profile_id;
    v_input_document_id := input_document_id;
    v_group_id := group_id;

    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_flag_id := (flags).resource_id;
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_field_ids := COALESCE((fields).resource_ids, ARRAY[]::uuid[]);
    v_upload_ids := COALESCE((uploads).resource_ids, ARRAY[]::uuid[]);
    v_image_ids := COALESCE((images).resource_ids, ARRAY[]::uuid[]);
    v_text_ids := COALESCE((texts).resource_ids, ARRAY[]::uuid[]);

    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    is_create := (v_input_document_id IS NULL);

    IF is_create THEN
        INSERT INTO document_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_document_id;
    ELSE
        v_document_id := v_input_document_id;
        UPDATE document_artifact
        SET updated_at = NOW()
        WHERE id = v_document_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Document not found: %', v_input_document_id;
        END IF;
    END IF;

    INSERT INTO document_groups_junction (document_id, group_id, created_at, active, generated, mcp)
    VALUES (v_document_id, v_group_id, NOW(), true, false, false)
    ON CONFLICT DO NOTHING;

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

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_image_ids) AS iid
        WHERE NOT EXISTS (SELECT 1 FROM images_resource WHERE id = iid)
    ) THEN
        RAISE EXCEPTION 'One or more image_ids not found';
    END IF;

    IF EXISTS (
        SELECT 1 FROM UNNEST(v_text_ids) AS tid
        WHERE NOT EXISTS (SELECT 1 FROM texts_resource WHERE id = tid)
    ) THEN
        RAISE EXCEPTION 'One or more text_ids not found';
    END IF;

    -- Deactivate old links on update (workflow semantics)
    IF NOT is_create THEN
        DELETE FROM document_names_junction WHERE document_id = v_document_id;
        DELETE FROM document_descriptions_junction WHERE document_id = v_document_id;
        DELETE FROM document_departments_junction WHERE document_id = v_document_id;
        DELETE FROM document_parameter_fields_junction WHERE document_id = v_document_id;
        DELETE FROM document_parameters_junction WHERE document_id = v_document_id;
        DELETE FROM document_uploads_junction WHERE document_id = v_document_id;
        DELETE FROM document_images_junction WHERE document_id = v_document_id;
        DELETE FROM document_texts_junction WHERE document_id = v_document_id;
        -- Update existing flags
        UPDATE document_flags_junction SET
            flag_id = COALESCE(v_flag_id, document_flags_junction.flag_id),
            value = CASE WHEN v_flag_id IS NOT NULL THEN true ELSE false END
        WHERE document_id = v_document_id;
    END IF;

    -- Tool-call tracking: one run per save
    v_run_id := uuidv7();
    INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
    VALUES (v_run_id, 0, 0, 0, v_group_id, NOW(), NOW());

    -- names
    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- flags (single-select but tracked like multi for consistency)
    IF v_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_flag_id, v_call_id);
        END IF;
    END IF;

    -- departments
    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT did, v_call_id FROM UNNEST(v_department_ids) did;
        END IF;
    END IF;

    -- fields
    IF COALESCE(array_length(v_field_ids, 1), 0) > 0 THEN
        IF (fields).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).create_tool_id, v_call_id);
            INSERT INTO fields_calls_connection (fields_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
        END IF;
        IF (fields).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).link_tool_id, v_call_id);
            INSERT INTO fields_calls_connection (fields_id, call_id)
            SELECT fid, v_call_id FROM UNNEST(v_field_ids) fid;
        END IF;
    END IF;

    -- uploads
    IF COALESCE(array_length(v_upload_ids, 1), 0) > 0 THEN
        IF (uploads).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_uploads_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((uploads).create_tool_id, v_call_id);
            INSERT INTO uploads_calls_connection (uploads_id, call_id)
            SELECT uid, v_call_id FROM UNNEST(v_upload_ids) uid;
        END IF;
        IF (uploads).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_uploads_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((uploads).link_tool_id, v_call_id);
            INSERT INTO uploads_calls_connection (uploads_id, call_id)
            SELECT uid, v_call_id FROM UNNEST(v_upload_ids) uid;
        END IF;
    END IF;

    -- images
    IF COALESCE(array_length(v_image_ids, 1), 0) > 0 THEN
        IF (images).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).create_tool_id, v_call_id);
            INSERT INTO images_calls_connection (images_id, call_id)
            SELECT iid, v_call_id FROM UNNEST(v_image_ids) iid;
        END IF;
        IF (images).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).link_tool_id, v_call_id);
            INSERT INTO images_calls_connection (images_id, call_id)
            SELECT iid, v_call_id FROM UNNEST(v_image_ids) iid;
        END IF;
    END IF;

    -- texts
    IF COALESCE(array_length(v_text_ids, 1), 0) > 0 THEN
        IF (texts).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_create_texts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((texts).create_tool_id, v_call_id);
            INSERT INTO texts_calls_connection (texts_id, call_id)
            SELECT tid, v_call_id FROM UNNEST(v_text_ids) tid;
        END IF;
        IF (texts).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'document_save_link_texts_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((texts).link_tool_id, v_call_id);
            INSERT INTO texts_calls_connection (texts_id, call_id)
            SELECT tid, v_call_id FROM UNNEST(v_text_ids) tid;
        END IF;
    END IF;

    -- Upsert active links
    IF v_name_id IS NOT NULL THEN
        INSERT INTO document_names_junction (document_id, name_id, created_at)
        VALUES (v_document_id, v_name_id, NOW())
        ON CONFLICT ON CONSTRAINT document_names_pkey DO NOTHING;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO document_descriptions_junction (document_id, description_id, created_at)
        VALUES (v_document_id, v_description_id, NOW())
        ON CONFLICT ON CONSTRAINT document_descriptions_pkey DO NOTHING;
    END IF;

    -- Insert or update active flag
    IF v_flag_id IS NOT NULL THEN
        INSERT INTO document_flags_junction (document_id, flag_id, value, created_at)
        SELECT v_document_id,
            COALESCE(v_flag_id, f.id),
            CASE WHEN v_flag_id IS NOT NULL THEN true ELSE false END,
            NOW()
        FROM flags_resource f
        WHERE f.name = 'document_active'
        ON CONFLICT ON CONSTRAINT document_flags_pkey DO UPDATE SET
            flag_id = COALESCE(EXCLUDED.flag_id, document_flags_junction.flag_id),
            value = EXCLUDED.value;
    END IF;

    -- Link departments
    INSERT INTO document_departments_junction (document_id, department_id, active, created_at)
    SELECT v_document_id, did, true, NOW()
    FROM UNNEST(v_department_ids) AS did
    WHERE COALESCE(array_length(v_department_ids, 1), 0) > 0
    ON CONFLICT ON CONSTRAINT document_departments_pkey DO UPDATE SET
        active = true;

    -- Link fields
    INSERT INTO document_parameter_fields_junction (document_id, parameter_field_id, active, created_at)
    SELECT v_document_id, pfr.id, true, NOW()
    FROM UNNEST(v_field_ids) AS field_resource_id
    JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
    WHERE COALESCE(array_length(v_field_ids, 1), 0) > 0
    ON CONFLICT (document_id, parameter_field_id) DO NOTHING;

    -- Link parameters (derived from field -> parameter relationships)
    INSERT INTO document_parameters_junction (document_id, parameter_id, type, active, created_at)
    SELECT DISTINCT v_document_id, pfr.parameter_id, 'direct'::link_type, true, NOW()
    FROM UNNEST(v_field_ids) AS field_resource_id
    JOIN parameter_fields_resource pfr ON pfr.field_id = field_resource_id
    WHERE COALESCE(array_length(v_field_ids, 1), 0) > 0
      AND pfr.parameter_id IS NOT NULL
    ON CONFLICT (document_id, parameter_id, type) DO UPDATE SET
        active = true;

    -- Link uploads
    INSERT INTO document_uploads_junction (document_id, uploads_id, active, created_at)
    SELECT v_document_id, uid, true, NOW()
    FROM UNNEST(v_upload_ids) AS uid
    WHERE COALESCE(array_length(v_upload_ids, 1), 0) > 0
    ON CONFLICT (document_id, uploads_id) DO UPDATE SET
        active = true;

    -- Link images
    INSERT INTO document_images_junction (document_id, images_id, active, created_at)
    SELECT v_document_id, iid, true, NOW()
    FROM UNNEST(v_image_ids) AS iid
    WHERE COALESCE(array_length(v_image_ids, 1), 0) > 0
    ON CONFLICT ON CONSTRAINT document_images_junction_pkey DO UPDATE SET
        active = true;

    -- Link texts
    INSERT INTO document_texts_junction (document_id, texts_id, active, created_at)
    SELECT v_document_id, tid, true, NOW()
    FROM UNNEST(v_text_ids) AS tid
    WHERE COALESCE(array_length(v_text_ids, 1), 0) > 0
    ON CONFLICT ON CONSTRAINT document_texts_junction_pkey DO UPDATE SET
        active = true;

    -- Sync linked resources with name/description
    UPDATE documents_resource r
    SET name = n.name,
        description = d.description
    FROM document_documents_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.documents_id = r.id
      AND j.document_id = v_document_id;

    RETURN QUERY SELECT v_document_id;
END;
$$;

