-- Patch scenario draft - accepts resource IDs and creates/updates draft
-- Creates draft if input_draft_id is NULL, updates if exists
-- Links resources via junction tables

DO $$
BEGIN
    DROP TYPE IF EXISTS types.scenario_resource_action CASCADE;
    CREATE TYPE types.scenario_resource_action AS (
        resource_id uuid,
        create_tool_id uuid,
        link_tool_id uuid
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP TYPE IF EXISTS types.scenario_multi_resource_action CASCADE;
    CREATE TYPE types.scenario_multi_resource_action AS (
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
        WHERE proname = 'api_patch_scenario_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_scenario_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_scenario_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    group_id uuid DEFAULT NULL,
    names types.scenario_resource_action DEFAULT NULL,
    descriptions types.scenario_resource_action DEFAULT NULL,
    problem_statements types.scenario_resource_action DEFAULT NULL,
    flags types.scenario_multi_resource_action DEFAULT NULL,
    departments types.scenario_multi_resource_action DEFAULT NULL,
    personas types.scenario_multi_resource_action DEFAULT NULL,
    documents types.scenario_multi_resource_action DEFAULT NULL,
    parameters types.scenario_multi_resource_action DEFAULT NULL,
    parameter_fields types.scenario_multi_resource_action DEFAULT NULL,
    images types.scenario_multi_resource_action DEFAULT NULL,
    objectives types.scenario_multi_resource_action DEFAULT NULL,
    videos types.scenario_multi_resource_action DEFAULT NULL,
    questions types.scenario_multi_resource_action DEFAULT NULL,
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
#variable_conflict use_column
DECLARE
    v_draft_id uuid;
    v_new_version int;
    v_draft_exists boolean := false;
    v_profile_id uuid := profile_id;  -- This is profile_artifact.id
    v_profiles_resource_id uuid;      -- This is profiles_resource.id (for FK)
    v_group_id uuid;
    -- Resource IDs extracted from actions
    name_id uuid;
    description_id uuid;
    problem_statement_id uuid;
    active_flag_id uuid;
    objectives_enabled_flag_id uuid;
    images_enabled_flag_id uuid;
    video_enabled_flag_id uuid;
    questions_enabled_flag_id uuid;
    problem_statement_enabled_flag_id uuid;
    department_ids uuid[];
    persona_ids uuid[];
    document_ids uuid[];
    parameter_ids uuid[];
    parameter_field_ids uuid[];
    image_ids uuid[];
    objective_ids uuid[];
    video_ids uuid[];
    question_ids uuid[];
    flag_ids uuid[];
    -- Tool-call logging
    v_run_id uuid;
    v_call_id uuid;
BEGIN
    name_id := (names).resource_id;
    description_id := (descriptions).resource_id;
    problem_statement_id := (problem_statements).resource_id;
    active_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'scenario_active'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    objectives_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'objectives_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    images_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'images_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    video_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'video_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    questions_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'questions_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    problem_statement_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.type = 'problem_statement_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    persona_ids := COALESCE((personas).resource_ids, ARRAY[]::uuid[]);
    document_ids := COALESCE((documents).resource_ids, ARRAY[]::uuid[]);
    parameter_ids := COALESCE((parameters).resource_ids, ARRAY[]::uuid[]);
    parameter_field_ids := COALESCE((parameter_fields).resource_ids, ARRAY[]::uuid[]);
    image_ids := COALESCE((images).resource_ids, ARRAY[]::uuid[]);
    objective_ids := COALESCE((objectives).resource_ids, ARRAY[]::uuid[]);
    video_ids := COALESCE((videos).resource_ids, ARRAY[]::uuid[]);
    question_ids := COALESCE((questions).resource_ids, ARRAY[]::uuid[]);
    flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);

    -- Resolve profile_artifact.id to profiles_resource.id via junction table
    -- scenario_drafts_profiles_connection has FK to profiles_resource, not profile_artifact
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = v_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'No profiles_resource linked to profile_artifact: %', v_profile_id;
    END IF;
    -- Validate resource IDs exist (error if missing and provided)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;
    
    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;
    
    IF active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', active_flag_id;
    END IF;

    IF objectives_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = objectives_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', objectives_enabled_flag_id;
    END IF;

    IF images_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = images_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', images_enabled_flag_id;
    END IF;

    IF video_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = video_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', video_enabled_flag_id;
    END IF;

    IF questions_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = questions_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', questions_enabled_flag_id;
    END IF;

    IF problem_statement_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = problem_statement_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', problem_statement_enabled_flag_id;
    END IF;

    IF problem_statement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM problem_statements_resource WHERE id = problem_statement_id) THEN
        RAISE EXCEPTION 'Problem statement resource not found: %', problem_statement_id;
    END IF;

    IF department_ids IS NOT NULL THEN
        IF EXISTS (
            SELECT 1 FROM UNNEST(department_ids) as dept_id
            WHERE NOT EXISTS (SELECT 1 FROM departments_resource WHERE id = dept_id)
        ) THEN
            RAISE EXCEPTION 'One or more department resource IDs not found in departments_resource';
        END IF;
    END IF;

    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM scenario_drafts_entry WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at, session_id)
            VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE scenario_drafts_entry
        SET version = scenario_drafts_entry.version + 1,
            updated_at = now(),
            group_id = COALESCE(scenario_drafts_entry.group_id, v_group_id)
        WHERE id = input_draft_id
          AND EXISTS (SELECT 1 FROM scenario_drafts_profiles_connection pdj WHERE pdj.draft_id = scenario_drafts_entry.id AND pdj.profiles_id = v_profiles_resource_id)
          AND scenario_drafts_entry.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM scenario_drafts_names_connection WHERE scenario_drafts_names_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_descriptions_connection WHERE scenario_drafts_descriptions_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_flags_connection WHERE scenario_drafts_flags_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_departments_connection WHERE scenario_drafts_departments_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_personas_connection WHERE scenario_drafts_personas_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_documents_connection WHERE scenario_drafts_documents_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_parameters_connection WHERE scenario_drafts_parameters_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_fields_connection WHERE scenario_drafts_fields_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_images_connection WHERE scenario_drafts_images_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_objectives_connection WHERE scenario_drafts_objectives_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_problem_statements_connection WHERE scenario_drafts_problem_statements_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_videos_connection WHERE scenario_drafts_videos_connection.draft_id = v_draft_id;
            DELETE FROM scenario_drafts_questions_connection WHERE scenario_drafts_questions_connection.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_names_connection (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE SET version = v_new_version;
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_descriptions_connection (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF objectives_enabled_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF images_enabled_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF video_enabled_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF questions_enabled_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF problem_statement_enabled_flag_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
                VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF department_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_departments_connection (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM unnest(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF persona_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_personas_connection (draft_id, personas_id, version)
                SELECT v_draft_id, persona_id, v_new_version
                FROM unnest(persona_ids) as persona_id
                ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF document_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_documents_connection (draft_id, documents_id, version)
                SELECT v_draft_id, doc_id, v_new_version
                FROM unnest(document_ids) as doc_id
                ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF parameter_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_parameters_connection (draft_id, parameters_id, version)
                SELECT v_draft_id, param_id, v_new_version
                FROM unnest(parameter_ids) as param_id
                ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF parameter_field_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_fields_connection (draft_id, fields_id, version)
                SELECT v_draft_id, pf_id, v_new_version
                FROM unnest(parameter_field_ids) as pf_id
                ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF image_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_images_connection (draft_id, images_id, version)
                SELECT v_draft_id, image_id, v_new_version
                FROM unnest(image_ids) as image_id
                ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF objective_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_objectives_connection (draft_id, objectives_id, version)
                SELECT v_draft_id, objective_id, v_new_version
                FROM unnest(objective_ids) as objective_id
                ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF problem_statement_id IS NOT NULL THEN
                INSERT INTO scenario_drafts_problem_statements_connection (draft_id, problem_statements_id, version)
                VALUES (v_draft_id, problem_statement_id, v_new_version)
                ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF video_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_videos_connection (draft_id, videos_id, version)
                SELECT v_draft_id, video_id, v_new_version
                FROM unnest(video_ids) as video_id
                ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;

            IF question_ids IS NOT NULL THEN
                INSERT INTO scenario_drafts_questions_connection (draft_id, questions_id, version)
                SELECT v_draft_id, question_id, v_new_version
                FROM unnest(question_ids) as question_id
                ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE
                SET version = v_new_version;
            END IF;
        END IF;
    END IF;
    
    -- Create new draft if update failed or input_draft_id was NULL
    IF v_draft_id IS NULL THEN
        -- Create new group for draft
        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (SELECT id FROM sessions_entry WHERE sessions_entry.profile_id = v_profile_id AND sessions_entry.active = true ORDER BY created_at DESC LIMIT 1))
        RETURNING id INTO v_group_id;

        -- Create draft
        INSERT INTO scenario_drafts_entry (group_id)
        VALUES (v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;

    -- Link profile to draft (using profiles_resource.id, not profile_artifact.id)
    INSERT INTO scenario_drafts_profiles_connection (draft_id, profiles_id, version)
    VALUES (v_draft_id, v_profiles_resource_id, v_new_version);
        
        v_draft_exists := false;
        
        -- Insert resource links for new draft
        IF name_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_names_connection (draft_id, names_id, version)
            VALUES (v_draft_id, name_id, v_new_version)
            ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;
        
        IF description_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_descriptions_connection (draft_id, descriptions_id, version)
            VALUES (v_draft_id, description_id, v_new_version)
            ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;
        
        IF active_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, active_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF objectives_enabled_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF images_enabled_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF video_enabled_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF questions_enabled_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF problem_statement_enabled_flag_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_flags_connection (draft_id, flags_id, version)
            VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF department_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_departments_connection (draft_id, departments_id, version)
            SELECT v_draft_id, dept_id, v_new_version
            FROM unnest(department_ids) as dept_id
            ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF persona_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_personas_connection (draft_id, personas_id, version)
            SELECT v_draft_id, persona_id, v_new_version
            FROM unnest(persona_ids) as persona_id
            ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF document_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_documents_connection (draft_id, documents_id, version)
            SELECT v_draft_id, doc_id, v_new_version
            FROM unnest(document_ids) as doc_id
            ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF parameter_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_parameters_connection (draft_id, parameters_id, version)
            SELECT v_draft_id, param_id, v_new_version
            FROM unnest(parameter_ids) as param_id
            ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF parameter_field_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_fields_connection (draft_id, fields_id, version)
            SELECT v_draft_id, pf_id, v_new_version
            FROM unnest(parameter_field_ids) as pf_id
            ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF image_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_images_connection (draft_id, images_id, version)
            SELECT v_draft_id, image_id, v_new_version
            FROM unnest(image_ids) as image_id
            ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF objective_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_objectives_connection (draft_id, objectives_id, version)
            SELECT v_draft_id, objective_id, v_new_version
            FROM unnest(objective_ids) as objective_id
            ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF problem_statement_id IS NOT NULL THEN
            INSERT INTO scenario_drafts_problem_statements_connection (draft_id, problem_statements_id, version)
            VALUES (v_draft_id, problem_statement_id, v_new_version)
            ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF video_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_videos_connection (draft_id, videos_id, version)
            SELECT v_draft_id, video_id, v_new_version
            FROM unnest(video_ids) as video_id
            ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;

        IF question_ids IS NOT NULL THEN
            INSERT INTO scenario_drafts_questions_connection (draft_id, questions_id, version)
            SELECT v_draft_id, question_id, v_new_version
            FROM unnest(question_ids) as question_id
            ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE
            SET version = v_new_version;
        END IF;
    END IF;

    IF v_group_id IS NOT NULL THEN
        v_run_id := uuidv7();
        INSERT INTO runs_entry (
            id, group_id, created_at, updated_at
        ) VALUES (
            v_run_id, v_group_id, NOW(), NOW()
        );

        -- names
        IF name_id IS NOT NULL THEN
            IF (names).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (name_id, v_call_id);
            END IF;
            IF (names).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
                INSERT INTO names_calls_connection (names_id, call_id) VALUES (name_id, v_call_id);
            END IF;
        END IF;

        -- descriptions
        IF description_id IS NOT NULL THEN
            IF (descriptions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (description_id, v_call_id);
            END IF;
            IF (descriptions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
                INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (description_id, v_call_id);
            END IF;
        END IF;

        -- problem statements
        IF problem_statement_id IS NOT NULL THEN
            IF (problem_statements).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).create_tool_id, v_call_id);
                INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id) VALUES (problem_statement_id, v_call_id);
            END IF;
            IF (problem_statements).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).link_tool_id, v_call_id);
                INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id) VALUES (problem_statement_id, v_call_id);
            END IF;
        END IF;

        -- flags
        IF COALESCE(array_length(flag_ids, 1), 0) > 0 THEN
            IF (flags).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT x.flag_id, v_call_id FROM UNNEST(flag_ids) AS x(flag_id);
            END IF;
            IF (flags).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
                INSERT INTO flags_calls_connection (flags_id, call_id)
                SELECT x.flag_id, v_call_id FROM UNNEST(flag_ids) AS x(flag_id);
            END IF;
        END IF;

        -- departments
        IF COALESCE(array_length(department_ids, 1), 0) > 0 THEN
            IF (departments).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
                INSERT INTO departments_calls_connection (departments_id, call_id)
                SELECT x.department_id, v_call_id FROM UNNEST(department_ids) AS x(department_id);
            END IF;
            IF (departments).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
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
                VALUES (v_call_id, 'scenario_draft_create_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((personas).create_tool_id, v_call_id);
                INSERT INTO personas_calls_connection (personas_id, call_id)
                SELECT x.persona_id, v_call_id FROM UNNEST(persona_ids) AS x(persona_id);
            END IF;
            IF (personas).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
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
                VALUES (v_call_id, 'scenario_draft_create_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).create_tool_id, v_call_id);
                INSERT INTO documents_calls_connection (documents_id, call_id)
                SELECT x.document_id, v_call_id FROM UNNEST(document_ids) AS x(document_id);
            END IF;
            IF (documents).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).link_tool_id, v_call_id);
                INSERT INTO documents_calls_connection (documents_id, call_id)
                SELECT x.document_id, v_call_id FROM UNNEST(document_ids) AS x(document_id);
            END IF;
        END IF;

        -- parameters
        IF COALESCE(array_length(parameter_ids, 1), 0) > 0 THEN
            IF (parameters).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT x.parameter_id, v_call_id FROM UNNEST(parameter_ids) AS x(parameter_id);
            END IF;
            IF (parameters).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
                INSERT INTO parameters_calls_connection (parameters_id, call_id)
                SELECT x.parameter_id, v_call_id FROM UNNEST(parameter_ids) AS x(parameter_id);
            END IF;
        END IF;

        -- parameter fields (payload IDs are field IDs, map to parameter_fields_resource.id)
        IF COALESCE(array_length(parameter_field_ids, 1), 0) > 0 THEN
            IF (parameter_fields).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
                INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                SELECT pfr.id, v_call_id
                FROM UNNEST(parameter_field_ids) AS x(field_id)
                JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
            END IF;
            IF (parameter_fields).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
                INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
                SELECT pfr.id, v_call_id
                FROM UNNEST(parameter_field_ids) AS x(field_id)
                JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
            END IF;
        END IF;

        -- images
        IF COALESCE(array_length(image_ids, 1), 0) > 0 THEN
            IF (images).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).create_tool_id, v_call_id);
                INSERT INTO images_calls_connection (images_id, call_id)
                SELECT x.image_id, v_call_id FROM UNNEST(image_ids) AS x(image_id);
            END IF;
            IF (images).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).link_tool_id, v_call_id);
                INSERT INTO images_calls_connection (images_id, call_id)
                SELECT x.image_id, v_call_id FROM UNNEST(image_ids) AS x(image_id);
            END IF;
        END IF;

        -- objectives
        IF COALESCE(array_length(objective_ids, 1), 0) > 0 THEN
            IF (objectives).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).create_tool_id, v_call_id);
                INSERT INTO objectives_calls_connection (objectives_id, call_id)
                SELECT x.objective_id, v_call_id FROM UNNEST(objective_ids) AS x(objective_id);
            END IF;
            IF (objectives).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).link_tool_id, v_call_id);
                INSERT INTO objectives_calls_connection (objectives_id, call_id)
                SELECT x.objective_id, v_call_id FROM UNNEST(objective_ids) AS x(objective_id);
            END IF;
        END IF;

        -- videos
        IF COALESCE(array_length(video_ids, 1), 0) > 0 THEN
            IF (videos).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).create_tool_id, v_call_id);
                INSERT INTO videos_calls_connection (videos_id, call_id)
                SELECT x.video_id, v_call_id FROM UNNEST(video_ids) AS x(video_id);
            END IF;
            IF (videos).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).link_tool_id, v_call_id);
                INSERT INTO videos_calls_connection (videos_id, call_id)
                SELECT x.video_id, v_call_id FROM UNNEST(video_ids) AS x(video_id);
            END IF;
        END IF;

        -- questions
        IF COALESCE(array_length(question_ids, 1), 0) > 0 THEN
            IF (questions).create_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_create_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).create_tool_id, v_call_id);
                INSERT INTO questions_calls_connection (questions_id, call_id)
                SELECT x.question_id, v_call_id FROM UNNEST(question_ids) AS x(question_id);
            END IF;
            IF (questions).link_tool_id IS NOT NULL THEN
                v_call_id := uuidv7();
                INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
                VALUES (v_call_id, 'scenario_draft_link_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
                INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).link_tool_id, v_call_id);
                INSERT INTO questions_calls_connection (questions_id, call_id)
                SELECT x.question_id, v_call_id FROM UNNEST(question_ids) AS x(question_id);
            END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END $$;
