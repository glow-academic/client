-- Patch persona draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_persona_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_persona_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_persona_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.persona_resource_action DEFAULT NULL,
    descriptions types.persona_resource_action DEFAULT NULL,
    colors types.persona_resource_action DEFAULT NULL,
    icons types.persona_resource_action DEFAULT NULL,
    instructions types.persona_resource_action DEFAULT NULL,
    flags types.persona_resource_action DEFAULT NULL,
    departments types.persona_multi_resource_action DEFAULT NULL,
    parameter_fields types.persona_multi_resource_action DEFAULT NULL,
    examples types.persona_multi_resource_action DEFAULT NULL,
    parameters types.persona_multi_resource_action DEFAULT NULL,
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
    -- Extracted resource IDs
    v_name_id uuid;
    v_description_id uuid;
    v_color_id uuid;
    v_icon_id uuid;
    v_instructions_id uuid;
    v_active_flag_id uuid;
    v_department_ids uuid[];
    v_parameter_field_ids uuid[];
    v_example_ids uuid[];
    v_parameter_ids uuid[];
    -- Call tracking variables
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Extract resource IDs from composites
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_color_id := (colors).resource_id;
    v_icon_id := (icons).resource_id;
    v_instructions_id := (instructions).resource_id;
    v_active_flag_id := (flags).resource_id;
    v_department_ids := (departments).resource_ids;
    v_parameter_field_ids := (parameter_fields).resource_ids;
    v_example_ids := (examples).resource_ids;
    v_parameter_ids := (parameters).resource_ids;

    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    -- profiles_drafts_connection has FK to profiles_resource, not profile_artifact
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;
    -- Validate resource IDs exist (error if missing and provided)
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_color_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM colors_resource WHERE id = v_color_id) THEN
        RAISE EXCEPTION 'Color resource not found: %', v_color_id;
    END IF;

    IF v_icon_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM icons_resource WHERE id = v_icon_id) THEN
        RAISE EXCEPTION 'Icon resource not found: %', v_icon_id;
    END IF;

    IF v_instructions_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instructions_resource WHERE id = v_instructions_id) THEN
        RAISE EXCEPTION 'Instructions resource not found: %', v_instructions_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_department_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_department_ids) as dept_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = dept_id)
        ) THEN
            RAISE EXCEPTION 'One or more department resource IDs not found in departments_resource';
        END IF;
    END IF;

    IF v_parameter_field_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_parameter_field_ids) as fid
            WHERE NOT EXISTS (SELECT 1 FROM parameter_fields_resource WHERE id = fid)
        ) THEN
            RAISE EXCEPTION 'One or more parameter field resource IDs not found in parameter_fields_resource';
        END IF;
    END IF;

    IF v_example_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_example_ids) as eid
            WHERE NOT EXISTS (SELECT 1 FROM examples_resource WHERE id = eid)
        ) THEN
            RAISE EXCEPTION 'One or more example resource IDs not found in examples_resource';
        END IF;
    END IF;

    IF v_parameter_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(v_parameter_ids) as pid
            WHERE NOT EXISTS (SELECT 1 FROM parameters_resource WHERE id = pid)
        ) THEN
            RAISE EXCEPTION 'One or more parameter resource IDs not found in parameters_resource';
        END IF;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT vde.group_id INTO v_group_id FROM view_drafts_entry vde WHERE vde.id = input_draft_id;

        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
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

            -- Delete old resource links
            DELETE FROM names_drafts_connection WHERE names_drafts_connection.draft_id = v_draft_id;
            DELETE FROM descriptions_drafts_connection WHERE descriptions_drafts_connection.draft_id = v_draft_id;
            DELETE FROM colors_drafts_connection WHERE colors_drafts_connection.draft_id = v_draft_id;
            DELETE FROM icons_drafts_connection WHERE icons_drafts_connection.draft_id = v_draft_id;
            DELETE FROM instructions_drafts_connection WHERE instructions_drafts_connection.draft_id = v_draft_id;
            DELETE FROM flags_drafts_connection WHERE flags_drafts_connection.draft_id = v_draft_id;
            DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;
            DELETE FROM parameter_fields_drafts_connection WHERE parameter_fields_drafts_connection.draft_id = v_draft_id;
            DELETE FROM examples_drafts_connection WHERE examples_drafts_connection.draft_id = v_draft_id;
            DELETE FROM parameters_drafts_connection WHERE parameters_drafts_connection.draft_id = v_draft_id;

            -- Insert new resource links
            IF v_name_id IS NOT NULL THEN
                INSERT INTO names_drafts_connection (draft_id, names_id, version)
                VALUES (v_draft_id, v_name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF v_description_id IS NOT NULL THEN
                INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
                VALUES (v_draft_id, v_description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_color_id IS NOT NULL THEN
                INSERT INTO colors_drafts_connection (draft_id, colors_id, version)
                VALUES (v_draft_id, v_color_id, v_new_version)
                ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_icon_id IS NOT NULL THEN
                INSERT INTO icons_drafts_connection (draft_id, icons_id, version)
                VALUES (v_draft_id, v_icon_id, v_new_version)
                ON CONFLICT ON CONSTRAINT icons_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_instructions_id IS NOT NULL THEN
                INSERT INTO instructions_drafts_connection (draft_id, instructions_id, version)
                VALUES (v_draft_id, v_instructions_id, v_new_version)
                ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_active_flag_id IS NOT NULL THEN
                INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, v_active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            -- Handle array resources (departments, fields, examples)
            IF v_department_ids IS NOT NULL THEN
                DELETE FROM departments_drafts_connection WHERE departments_drafts_connection.draft_id = v_draft_id;
                INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(v_department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_parameter_field_ids IS NOT NULL THEN
                DELETE FROM parameter_fields_drafts_connection WHERE parameter_fields_drafts_connection.draft_id = v_draft_id;
                INSERT INTO parameter_fields_drafts_connection (draft_id, parameter_fields_id, version)
                SELECT v_draft_id, field_id, v_new_version
                FROM UNNEST(v_parameter_field_ids) as field_id
                ON CONFLICT ON CONSTRAINT parameter_fields_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_example_ids IS NOT NULL THEN
                DELETE FROM examples_drafts_connection WHERE examples_drafts_connection.draft_id = v_draft_id;
                INSERT INTO examples_drafts_connection (draft_id, examples_id, version)
                SELECT v_draft_id, ex_id, v_new_version
                FROM UNNEST(v_example_ids) as ex_id
                ON CONFLICT ON CONSTRAINT examples_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF v_parameter_ids IS NOT NULL THEN
                DELETE FROM parameters_drafts_connection WHERE parameters_drafts_connection.draft_id = v_draft_id;
                INSERT INTO parameters_drafts_connection (draft_id, parameters_id, version)
                SELECT v_draft_id, param_id, v_new_version
                FROM UNNEST(v_parameter_ids) as param_id
                ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            -- === TOOL CALL TRACKING (UPDATE path) ===
            IF group_id IS NOT NULL THEN
                v_run_id := uuidv7();
                INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
                VALUES (v_run_id, 0, 0, 0, group_id, NOW(), NOW());
            END IF;

            -- names
            IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
                IF (names).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;
                IF (names).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                    INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
                END IF;
            END IF;

            -- descriptions
            IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
                IF (descriptions).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;
                IF (descriptions).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                    INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
                END IF;
            END IF;

            -- colors
            IF v_run_id IS NOT NULL AND v_color_id IS NOT NULL THEN
                IF (colors).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
                    INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
                END IF;
                IF (colors).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
                    INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
                END IF;
            END IF;

            -- icons
            IF v_run_id IS NOT NULL AND v_icon_id IS NOT NULL THEN
                IF (icons).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((icons).create_tool_id, v_call_id);
                    INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
                END IF;
                IF (icons).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((icons).link_tool_id, v_call_id);
                    INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
                END IF;
            END IF;

            -- instructions
            IF v_run_id IS NOT NULL AND v_instructions_id IS NOT NULL THEN
                IF (instructions).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((instructions).create_tool_id, v_call_id);
                    INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
                END IF;
                IF (instructions).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((instructions).link_tool_id, v_call_id);
                    INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
                END IF;
            END IF;

            -- flags
            IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
                IF (flags).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;
                IF (flags).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                    INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
                END IF;
            END IF;

            -- departments (multi-select)
            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
                IF (departments).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
                END IF;
                IF (departments).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                    INSERT INTO departments_calls_connection (departments_id, call_id)
                    SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
                END IF;
            END IF;

            -- parameter_fields (multi-select)
            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_field_ids, 1), 0) > 0 THEN
                IF (parameter_fields).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
                    INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                    SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
                END IF;
                IF (parameter_fields).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
                    INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                    SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
                END IF;
            END IF;

            -- examples (multi-select)
            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_example_ids, 1), 0) > 0 THEN
                IF (examples).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((examples).create_tool_id, v_call_id);
                    INSERT INTO examples_calls_connection (examples_id, call_id)
                    SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
                END IF;
                IF (examples).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((examples).link_tool_id, v_call_id);
                    INSERT INTO examples_calls_connection (examples_id, call_id)
                    SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
                END IF;
            END IF;

            -- parameters (multi-select)
            IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_ids, 1), 0) > 0 THEN
                IF (parameters).create_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
                    INSERT INTO parameters_calls_connection (parameters_id, call_id)
                    SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
                END IF;
                IF (parameters).link_tool_id IS NOT NULL THEN
                    v_call_id := uuidv7();
                    INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                    VALUES (v_call_id, 'persona_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                    INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
                    INSERT INTO parameters_calls_connection (parameters_id, call_id)
                    SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
                END IF;
            END IF;

            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;

    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups_entry (created_at, updated_at, session_id)
    VALUES (NOW(), NOW(), (SELECT id FROM view_sessions_entry WHERE view_sessions_entry.profile_id = v_profile_id AND view_sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
    RETURNING id INTO v_group_id;

    -- Create new draft with group_id
    INSERT INTO drafts_entry (artifact, group_id)
    VALUES ('persona'::artifact_type, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link profile to draft (using profiles_resource.id, not profile_artifact.id)
    INSERT INTO profiles_drafts_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profiles_resource_id, v_new_version);

    -- Link resources to draft
    IF v_name_id IS NOT NULL THEN
        INSERT INTO names_drafts_connection (draft_id, names_id, version)
        VALUES (v_draft_id, v_name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO descriptions_drafts_connection (draft_id, descriptions_id, version)
        VALUES (v_draft_id, v_description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_color_id IS NOT NULL THEN
        INSERT INTO colors_drafts_connection (draft_id, colors_id, version)
        VALUES (v_draft_id, v_color_id, v_new_version)
        ON CONFLICT ON CONSTRAINT colors_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_icon_id IS NOT NULL THEN
        INSERT INTO icons_drafts_connection (draft_id, icons_id, version)
        VALUES (v_draft_id, v_icon_id, v_new_version)
        ON CONFLICT ON CONSTRAINT icons_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_instructions_id IS NOT NULL THEN
        INSERT INTO instructions_drafts_connection (draft_id, instructions_id, version)
        VALUES (v_draft_id, v_instructions_id, v_new_version)
        ON CONFLICT ON CONSTRAINT instructions_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO flags_drafts_connection (draft_id, flags_id, version)
        VALUES (v_draft_id, v_active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    -- Handle array resources
    IF v_department_ids IS NOT NULL THEN
        INSERT INTO departments_drafts_connection (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(v_department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_parameter_field_ids IS NOT NULL THEN
        INSERT INTO parameter_fields_drafts_connection (draft_id, parameter_fields_id, version)
        SELECT v_draft_id, field_id, v_new_version
        FROM UNNEST(v_parameter_field_ids) as field_id
        ON CONFLICT ON CONSTRAINT parameter_fields_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_example_ids IS NOT NULL THEN
        INSERT INTO examples_drafts_connection (draft_id, examples_id, version)
        SELECT v_draft_id, ex_id, v_new_version
        FROM UNNEST(v_example_ids) as ex_id
        ON CONFLICT ON CONSTRAINT examples_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    IF v_parameter_ids IS NOT NULL THEN
        INSERT INTO parameters_drafts_connection (draft_id, parameters_id, version)
        SELECT v_draft_id, param_id, v_new_version
        FROM UNNEST(v_parameter_ids) as param_id
        ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
        SET version = v_new_version;
    END IF;

    -- === TOOL CALL TRACKING (CREATE path) ===
    v_run_id := NULL;

    IF group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at)
        VALUES (v_run_id, 0, 0, 0, group_id, NOW(), NOW());
    END IF;

    -- names
    IF v_run_id IS NOT NULL AND v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_run_id IS NOT NULL AND v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- colors
    IF v_run_id IS NOT NULL AND v_color_id IS NOT NULL THEN
        IF (colors).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((colors).create_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
        END IF;
        IF (colors).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_colors_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((colors).link_tool_id, v_call_id);
            INSERT INTO colors_calls_connection (colors_id, call_id) VALUES (v_color_id, v_call_id);
        END IF;
    END IF;

    -- icons
    IF v_run_id IS NOT NULL AND v_icon_id IS NOT NULL THEN
        IF (icons).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((icons).create_tool_id, v_call_id);
            INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
        END IF;
        IF (icons).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_icons_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((icons).link_tool_id, v_call_id);
            INSERT INTO icons_calls_connection (icons_id, call_id) VALUES (v_icon_id, v_call_id);
        END IF;
    END IF;

    -- instructions
    IF v_run_id IS NOT NULL AND v_instructions_id IS NOT NULL THEN
        IF (instructions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((instructions).create_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
        IF (instructions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_instructions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((instructions).link_tool_id, v_call_id);
            INSERT INTO instructions_calls_connection (instructions_id, call_id) VALUES (v_instructions_id, v_call_id);
        END IF;
    END IF;

    -- flags
    IF v_run_id IS NOT NULL AND v_active_flag_id IS NOT NULL THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id) VALUES (v_active_flag_id, v_call_id);
        END IF;
    END IF;

    -- departments (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT dept_id, v_call_id FROM UNNEST(v_department_ids) AS dept_id;
        END IF;
    END IF;

    -- parameter_fields (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_field_ids, 1), 0) > 0 THEN
        IF (parameter_fields).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
        END IF;
        IF (parameter_fields).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT field_id, v_call_id FROM UNNEST(v_parameter_field_ids) AS field_id;
        END IF;
    END IF;

    -- examples (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_example_ids, 1), 0) > 0 THEN
        IF (examples).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((examples).create_tool_id, v_call_id);
            INSERT INTO examples_calls_connection (examples_id, call_id)
            SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
        END IF;
        IF (examples).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_examples_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((examples).link_tool_id, v_call_id);
            INSERT INTO examples_calls_connection (examples_id, call_id)
            SELECT ex_id, v_call_id FROM UNNEST(v_example_ids) AS ex_id;
        END IF;
    END IF;

    -- parameters (multi-select)
    IF v_run_id IS NOT NULL AND COALESCE(array_length(v_parameter_ids, 1), 0) > 0 THEN
        IF (parameters).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
        END IF;
        IF (parameters).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'persona_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tool_calls_junction (tool_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT param_id, v_call_id FROM UNNEST(v_parameter_ids) AS param_id;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
