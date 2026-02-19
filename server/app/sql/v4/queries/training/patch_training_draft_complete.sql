-- Patch training bundle draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables (13 multi-select resources, no single-select)

DO $$
BEGIN
    DROP TYPE IF EXISTS types.training_multi_resource_action CASCADE;
    CREATE TYPE types.training_multi_resource_action AS (
        resource_ids uuid[],
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_patch_training_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_training_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_training_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    departments types.training_multi_resource_action DEFAULT NULL,
    personas types.training_multi_resource_action DEFAULT NULL,
    documents types.training_multi_resource_action DEFAULT NULL,
    parameter_fields types.training_multi_resource_action DEFAULT NULL,
    parameters types.training_multi_resource_action DEFAULT NULL,
    fields types.training_multi_resource_action DEFAULT NULL,
    questions types.training_multi_resource_action DEFAULT NULL,
    options types.training_multi_resource_action DEFAULT NULL,
    videos types.training_multi_resource_action DEFAULT NULL,
    images types.training_multi_resource_action DEFAULT NULL,
    problem_statements types.training_multi_resource_action DEFAULT NULL,
    objectives types.training_multi_resource_action DEFAULT NULL,
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
    v_group_id uuid;
    -- Resource IDs extracted from actions
    department_ids uuid[];
    persona_ids uuid[];
    document_ids uuid[];
    parameter_field_ids uuid[];
    parameter_ids uuid[];
    field_ids uuid[];
    question_ids uuid[];
    option_ids uuid[];
    video_ids uuid[];
    image_ids uuid[];
    problem_statement_ids uuid[];
    objective_ids uuid[];
    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    -- Extract resource_ids from composite params
    department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    persona_ids := COALESCE((personas).resource_ids, ARRAY[]::uuid[]);
    document_ids := COALESCE((documents).resource_ids, ARRAY[]::uuid[]);
    parameter_field_ids := COALESCE((parameter_fields).resource_ids, ARRAY[]::uuid[]);
    parameter_ids := COALESCE((parameters).resource_ids, ARRAY[]::uuid[]);
    field_ids := COALESCE((fields).resource_ids, ARRAY[]::uuid[]);
    question_ids := COALESCE((questions).resource_ids, ARRAY[]::uuid[]);
    option_ids := COALESCE((options).resource_ids, ARRAY[]::uuid[]);
    video_ids := COALESCE((videos).resource_ids, ARRAY[]::uuid[]);
    image_ids := COALESCE((images).resource_ids, ARRAY[]::uuid[]);
    problem_statement_ids := COALESCE((problem_statements).resource_ids, ARRAY[]::uuid[]);
    objective_ids := COALESCE((objectives).resource_ids, ARRAY[]::uuid[]);

    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        SELECT group_id INTO v_group_id FROM training_drafts_entry WHERE id = input_draft_id;

        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;

        UPDATE training_drafts_entry
        SET version = training_drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(training_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM training_drafts_profiles_connection pdj WHERE pdj.draft_id = training_drafts_entry.id AND pdj.profiles_id = v_profiles_resource_id)
          AND training_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;

        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;

            -- Delete old resource links
            DELETE FROM training_drafts_departments_connection WHERE training_drafts_departments_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_personas_connection WHERE training_drafts_personas_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_documents_connection WHERE training_drafts_documents_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_fields_connection WHERE training_drafts_fields_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_parameters_connection WHERE training_drafts_parameters_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_questions_connection WHERE training_drafts_questions_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_options_connection WHERE training_drafts_options_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_videos_connection WHERE training_drafts_videos_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_images_connection WHERE training_drafts_images_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_problem_statements_connection WHERE training_drafts_problem_statements_connection.draft_id = v_draft_id;
            DELETE FROM training_drafts_objectives_connection WHERE training_drafts_objectives_connection.draft_id = v_draft_id;

            -- Insert new resource links
            IF department_ids IS NOT NULL THEN
                INSERT INTO training_drafts_departments_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM unnest(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF persona_ids IS NOT NULL THEN
                INSERT INTO training_drafts_personas_connection (draft_id, personas_id, version)
                SELECT v_draft_id, persona_id, v_new_version
                FROM unnest(persona_ids) as persona_id
                ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF document_ids IS NOT NULL THEN
                INSERT INTO training_drafts_documents_connection (draft_id, documents_id, version)
                SELECT v_draft_id, doc_id, v_new_version
                FROM unnest(document_ids) as doc_id
                ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF parameter_field_ids IS NOT NULL THEN
                INSERT INTO training_drafts_fields_connection (draft_id, fields_id, version)
                SELECT v_draft_id, pf_id, v_new_version
                FROM unnest(parameter_field_ids) as pf_id
                ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF parameter_ids IS NOT NULL THEN
                INSERT INTO training_drafts_parameters_connection (draft_id, parameters_id, version)
                SELECT v_draft_id, param_id, v_new_version
                FROM unnest(parameter_ids) as param_id
                ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF field_ids IS NOT NULL THEN
                INSERT INTO training_drafts_fields_connection (draft_id, fields_id, version)
                SELECT v_draft_id, f_id, v_new_version
                FROM unnest(field_ids) as f_id
                ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF question_ids IS NOT NULL THEN
                INSERT INTO training_drafts_questions_connection (draft_id, questions_id, version)
                SELECT v_draft_id, question_id, v_new_version
                FROM unnest(question_ids) as question_id
                ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF option_ids IS NOT NULL THEN
                INSERT INTO training_drafts_options_connection (draft_id, options_id, version)
                SELECT v_draft_id, option_id, v_new_version
                FROM unnest(option_ids) as option_id
                ON CONFLICT ON CONSTRAINT options_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF video_ids IS NOT NULL THEN
                INSERT INTO training_drafts_videos_connection (draft_id, videos_id, version)
                SELECT v_draft_id, video_id, v_new_version
                FROM unnest(video_ids) as video_id
                ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF image_ids IS NOT NULL THEN
                INSERT INTO training_drafts_images_connection (draft_id, images_id, version)
                SELECT v_draft_id, image_id, v_new_version
                FROM unnest(image_ids) as image_id
                ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF problem_statement_ids IS NOT NULL THEN
                INSERT INTO training_drafts_problem_statements_connection (draft_id, problem_statements_id, version)
                SELECT v_draft_id, ps_id, v_new_version
                FROM unnest(problem_statement_ids) as ps_id
                ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;

            IF objective_ids IS NOT NULL THEN
                INSERT INTO training_drafts_objectives_connection (draft_id, objectives_id, version)
                SELECT v_draft_id, objective_id, v_new_version
                FROM unnest(objective_ids) as objective_id
                ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;
        END IF;
    END IF;

    -- Create new draft if update failed or input_draft_id was NULL
    IF v_draft_id IS NULL THEN
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
        RETURNING id INTO v_group_id;

        INSERT INTO training_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

        INSERT INTO training_drafts_profiles_connection (draft_id, profiles_id, version)
        VALUES (v_draft_id, v_profiles_resource_id, v_new_version);

        v_draft_exists := false;

        -- Insert resource links for new draft
        IF department_ids IS NOT NULL THEN
            INSERT INTO training_drafts_departments_connection (draft_id, departments_id, version)
            SELECT v_draft_id, dept_id, v_new_version
            FROM unnest(department_ids) as dept_id
            ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF persona_ids IS NOT NULL THEN
            INSERT INTO training_drafts_personas_connection (draft_id, personas_id, version)
            SELECT v_draft_id, persona_id, v_new_version
            FROM unnest(persona_ids) as persona_id
            ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF document_ids IS NOT NULL THEN
            INSERT INTO training_drafts_documents_connection (draft_id, documents_id, version)
            SELECT v_draft_id, doc_id, v_new_version
            FROM unnest(document_ids) as doc_id
            ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF parameter_field_ids IS NOT NULL THEN
            INSERT INTO training_drafts_fields_connection (draft_id, fields_id, version)
            SELECT v_draft_id, pf_id, v_new_version
            FROM unnest(parameter_field_ids) as pf_id
            ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF parameter_ids IS NOT NULL THEN
            INSERT INTO training_drafts_parameters_connection (draft_id, parameters_id, version)
            SELECT v_draft_id, param_id, v_new_version
            FROM unnest(parameter_ids) as param_id
            ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF field_ids IS NOT NULL THEN
            INSERT INTO training_drafts_fields_connection (draft_id, fields_id, version)
            SELECT v_draft_id, f_id, v_new_version
            FROM unnest(field_ids) as f_id
            ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF question_ids IS NOT NULL THEN
            INSERT INTO training_drafts_questions_connection (draft_id, questions_id, version)
            SELECT v_draft_id, question_id, v_new_version
            FROM unnest(question_ids) as question_id
            ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF option_ids IS NOT NULL THEN
            INSERT INTO training_drafts_options_connection (draft_id, options_id, version)
            SELECT v_draft_id, option_id, v_new_version
            FROM unnest(option_ids) as option_id
            ON CONFLICT ON CONSTRAINT options_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF video_ids IS NOT NULL THEN
            INSERT INTO training_drafts_videos_connection (draft_id, videos_id, version)
            SELECT v_draft_id, video_id, v_new_version
            FROM unnest(video_ids) as video_id
            ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF image_ids IS NOT NULL THEN
            INSERT INTO training_drafts_images_connection (draft_id, images_id, version)
            SELECT v_draft_id, image_id, v_new_version
            FROM unnest(image_ids) as image_id
            ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF problem_statement_ids IS NOT NULL THEN
            INSERT INTO training_drafts_problem_statements_connection (draft_id, problem_statements_id, version)
            SELECT v_draft_id, ps_id, v_new_version
            FROM unnest(problem_statement_ids) as ps_id
            ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;

        IF objective_ids IS NOT NULL THEN
            INSERT INTO training_drafts_objectives_connection (draft_id, objectives_id, version)
            SELECT v_draft_id, objective_id, v_new_version
            FROM unnest(objective_ids) as objective_id
            ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE SET version = v_new_version;
        END IF;
    END IF;

    -- Tool call logging
    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (
            id, group_id, created_at, updated_at
        ) VALUES (
            v_run_id, v_group_id, NOW(), NOW()
        );

        -- departments
        IF COALESCE(array_length(department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT x.department_id, v_call_id FROM UNNEST(department_ids) AS x(department_id);
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT x.department_id, v_call_id FROM UNNEST(department_ids) AS x(department_id);
            END IF;
        END IF;

        -- personas
        IF COALESCE(array_length(persona_ids, 1), 0) > 0 THEN
            IF (personas).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((personas).create_tool_id, v_call_id);
                INSERT INTO personas_calls_connection (personas_id, call_id)
                SELECT x.persona_id, v_call_id FROM UNNEST(persona_ids) AS x(persona_id);
            END IF;
            IF (personas).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((personas).link_tool_id, v_call_id);
                INSERT INTO personas_calls_connection (personas_id, call_id)
                SELECT x.persona_id, v_call_id FROM UNNEST(persona_ids) AS x(persona_id);
            END IF;
        END IF;

        -- documents
        IF COALESCE(array_length(document_ids, 1), 0) > 0 THEN
            IF (documents).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).create_tool_id, v_call_id);
                INSERT INTO documents_calls_connection (documents_id, call_id)
                SELECT x.document_id, v_call_id FROM UNNEST(document_ids) AS x(document_id);
            END IF;
            IF (documents).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).link_tool_id, v_call_id);
                INSERT INTO documents_calls_connection (documents_id, call_id)
                SELECT x.document_id, v_call_id FROM UNNEST(document_ids) AS x(document_id);
            END IF;
        END IF;

        -- parameter fields
        IF COALESCE(array_length(parameter_field_ids, 1), 0) > 0 THEN
            IF (parameter_fields).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
                INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                SELECT pfr.id, v_call_id
                FROM UNNEST(parameter_field_ids) AS x(field_id)
                JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
            END IF;
            IF (parameter_fields).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
                INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                SELECT pfr.id, v_call_id
                FROM UNNEST(parameter_field_ids) AS x(field_id)
                JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
            END IF;
        END IF;

        -- parameters
        IF COALESCE(array_length(parameter_ids, 1), 0) > 0 THEN
            IF (parameters).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT x.parameter_id, v_call_id FROM UNNEST(parameter_ids) AS x(parameter_id);
            END IF;
            IF (parameters).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT x.parameter_id, v_call_id FROM UNNEST(parameter_ids) AS x(parameter_id);
            END IF;
        END IF;

        -- fields
        IF COALESCE(array_length(field_ids, 1), 0) > 0 THEN
            IF (fields).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).create_tool_id, v_call_id);
                INSERT INTO fields_calls_connection (fields_id, call_id)
                SELECT x.field_id, v_call_id FROM UNNEST(field_ids) AS x(field_id);
            END IF;
            IF (fields).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((fields).link_tool_id, v_call_id);
                INSERT INTO fields_calls_connection (fields_id, call_id)
                SELECT x.field_id, v_call_id FROM UNNEST(field_ids) AS x(field_id);
            END IF;
        END IF;

        -- questions
        IF COALESCE(array_length(question_ids, 1), 0) > 0 THEN
            IF (questions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).create_tool_id, v_call_id);
                INSERT INTO questions_calls_connection (questions_id, call_id)
                SELECT x.question_id, v_call_id FROM UNNEST(question_ids) AS x(question_id);
            END IF;
            IF (questions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).link_tool_id, v_call_id);
                INSERT INTO questions_calls_connection (questions_id, call_id)
                SELECT x.question_id, v_call_id FROM UNNEST(question_ids) AS x(question_id);
            END IF;
        END IF;

        -- options
        IF COALESCE(array_length(option_ids, 1), 0) > 0 THEN
            IF (options).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_options_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((options).create_tool_id, v_call_id);
                INSERT INTO options_calls_connection (options_id, call_id)
                SELECT x.option_id, v_call_id FROM UNNEST(option_ids) AS x(option_id);
            END IF;
            IF (options).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_options_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((options).link_tool_id, v_call_id);
                INSERT INTO options_calls_connection (options_id, call_id)
                SELECT x.option_id, v_call_id FROM UNNEST(option_ids) AS x(option_id);
            END IF;
        END IF;

        -- videos
        IF COALESCE(array_length(video_ids, 1), 0) > 0 THEN
            IF (videos).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).create_tool_id, v_call_id);
                INSERT INTO videos_calls_connection (videos_id, call_id)
                SELECT x.video_id, v_call_id FROM UNNEST(video_ids) AS x(video_id);
            END IF;
            IF (videos).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).link_tool_id, v_call_id);
                INSERT INTO videos_calls_connection (videos_id, call_id)
                SELECT x.video_id, v_call_id FROM UNNEST(video_ids) AS x(video_id);
            END IF;
        END IF;

        -- images
        IF COALESCE(array_length(image_ids, 1), 0) > 0 THEN
            IF (images).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).create_tool_id, v_call_id);
                INSERT INTO images_calls_connection (images_id, call_id)
                SELECT x.image_id, v_call_id FROM UNNEST(image_ids) AS x(image_id);
            END IF;
            IF (images).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).link_tool_id, v_call_id);
                INSERT INTO images_calls_connection (images_id, call_id)
                SELECT x.image_id, v_call_id FROM UNNEST(image_ids) AS x(image_id);
            END IF;
        END IF;

        -- problem statements
        IF COALESCE(array_length(problem_statement_ids, 1), 0) > 0 THEN
            IF (problem_statements).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).create_tool_id, v_call_id);
                INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id)
                SELECT x.ps_id, v_call_id FROM UNNEST(problem_statement_ids) AS x(ps_id);
            END IF;
            IF (problem_statements).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).link_tool_id, v_call_id);
                INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id)
                SELECT x.ps_id, v_call_id FROM UNNEST(problem_statement_ids) AS x(ps_id);
            END IF;
        END IF;

        -- objectives
        IF COALESCE(array_length(objective_ids, 1), 0) > 0 THEN
            IF (objectives).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_create_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).create_tool_id, v_call_id);
                INSERT INTO objectives_calls_connection (objectives_id, call_id)
                SELECT x.objective_id, v_call_id FROM UNNEST(objective_ids) AS x(objective_id);
            END IF;
            IF (objectives).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'training_draft_link_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).link_tool_id, v_call_id);
                INSERT INTO objectives_calls_connection (objectives_id, call_id)
                SELECT x.objective_id, v_call_id FROM UNNEST(objective_ids) AS x(objective_id);
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END $$;
