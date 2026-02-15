-- Unified save scenario function - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)
-- Resource-ID only contract (no text creation)
-- Accepts form fields directly (no draft_id dependency)

-- 0) Drop and recreate composite types for resource actions
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

-- 1) Drop function first (breaks dependency on types)
-- Drop all versions of the function using DO block to handle signature variations
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_save_scenario_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_save_scenario_v4(%s)', r.sig);
    END LOOP;
END $$;

-- 2) Drop types WITHOUT CASCADE (legacy composite types no longer used)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_save_scenario_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I', r.typname);
    END LOOP;
END $$;

-- 3) Recreate function with direct form data parameters (no draft_id)
CREATE OR REPLACE FUNCTION api_save_scenario_v4(
    profile_id uuid,
    input_scenario_id uuid DEFAULT NULL,
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
    questions types.scenario_multi_resource_action DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
#variable_conflict use_column
DECLARE
    v_scenario_id uuid;
    v_actor_name text;
    is_create boolean;
    v_group_id uuid;
    v_profile_id uuid;
    v_input_scenario_id uuid;
    v_name_id uuid;
    v_description_id uuid;
    v_problem_statement_id uuid;
    v_active_flag_id uuid;
    v_objectives_enabled_flag_id uuid;
    v_images_enabled_flag_id uuid;
    v_video_enabled_flag_id uuid;
    v_questions_enabled_flag_id uuid;
    v_problem_statement_enabled_flag_id uuid;
    v_department_ids uuid[];
    v_persona_ids uuid[];
    v_document_ids uuid[];
    v_parameter_ids uuid[];
    v_parameter_field_ids uuid[];
    v_image_ids uuid[];
    v_objective_ids uuid[];
    v_video_ids uuid[];
    v_question_ids uuid[];
    v_flag_ids uuid[];
    v_run_id uuid;
    v_call_id uuid;
    v_parameter_fields_call_id uuid;
    v_scenarios_resource_id uuid;
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_scenario_id := input_scenario_id;
    v_name_id := (names).resource_id;
    v_description_id := (descriptions).resource_id;
    v_problem_statement_id := (problem_statements).resource_id;
    v_active_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_active'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_objectives_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_objectives_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_images_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_images_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_video_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_video_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_questions_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_questions_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_problem_statement_enabled_flag_id := (
        SELECT fr.id FROM flags_resource fr
        WHERE fr.name = 'scenario_problem_statement_enabled'
          AND fr.id = ANY(COALESCE((flags).resource_ids, ARRAY[]::uuid[]))
        LIMIT 1
    );
    v_department_ids := COALESCE((departments).resource_ids, ARRAY[]::uuid[]);
    v_persona_ids := COALESCE((personas).resource_ids, ARRAY[]::uuid[]);
    v_document_ids := COALESCE((documents).resource_ids, ARRAY[]::uuid[]);
    v_parameter_ids := COALESCE((parameters).resource_ids, ARRAY[]::uuid[]);
    v_parameter_field_ids := COALESCE((parameter_fields).resource_ids, ARRAY[]::uuid[]);
    v_image_ids := COALESCE((images).resource_ids, ARRAY[]::uuid[]);
    v_objective_ids := COALESCE((objectives).resource_ids, ARRAY[]::uuid[]);
    v_video_ids := COALESCE((videos).resource_ids, ARRAY[]::uuid[]);
    v_question_ids := COALESCE((questions).resource_ids, ARRAY[]::uuid[]);
    v_flag_ids := COALESCE((flags).resource_ids, ARRAY[]::uuid[]);
    v_parameter_fields_call_id := NULL;

    -- Validate required fields
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'group_id is required';
    END IF;

    IF v_name_id IS NULL THEN
        RAISE EXCEPTION 'name_id is required';
    END IF;

    -- Determine if create or update
    is_create := (v_input_scenario_id IS NULL);

    -- Create or update scenario_artifact
    IF is_create THEN
        INSERT INTO scenario_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_scenario_id;
        -- Root status is now set on scenarios_resource (is_root = TRUE) below
    ELSE
        v_scenario_id := v_input_scenario_id;

        -- Check if scenario exists BEFORE attempting update
        IF NOT EXISTS (SELECT 1 FROM scenario_artifact WHERE id = v_scenario_id) THEN
            RAISE EXCEPTION 'Scenario not found: %', v_input_scenario_id;
        END IF;

        UPDATE scenario_artifact
        SET updated_at = NOW()
        WHERE id = v_scenario_id;

    END IF;

    -- Validate required resource IDs exist (single-select resources)
    IF v_name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = v_name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', v_name_id;
    END IF;

    IF v_description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = v_description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', v_description_id;
    END IF;

    IF v_problem_statement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM problem_statements_resource WHERE id = v_problem_statement_id) THEN
        RAISE EXCEPTION 'Problem statement resource not found: %', v_problem_statement_id;
    END IF;

    IF v_active_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_active_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_active_flag_id;
    END IF;

    IF v_objectives_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_objectives_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_objectives_enabled_flag_id;
    END IF;

    IF v_images_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_images_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_images_enabled_flag_id;
    END IF;

    IF v_video_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_video_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_video_enabled_flag_id;
    END IF;

    IF v_questions_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_questions_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_questions_enabled_flag_id;
    END IF;

    IF v_problem_statement_enabled_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_problem_statement_enabled_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_problem_statement_enabled_flag_id;
    END IF;

    -- For update: deactivate old links first (persona-style active history)
    IF NOT is_create THEN
        UPDATE scenario_names_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_descriptions_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_flags_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_departments_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_personas_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_documents_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_parameters_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_parameter_fields_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_images_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_objectives_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_problem_statements_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_videos_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
        UPDATE scenario_questions_junction SET active = false WHERE scenario_id = v_scenario_id AND active = true;
    END IF;

    -- Tool-call tracking: one run per save, explicit per-resource call linking.
    v_run_id := uuidv7();
    INSERT INTO runs_entry (
        id, input_tokens, output_tokens, cached_input_tokens, group_id, created_at, updated_at
    ) VALUES (
        v_run_id, 0, 0, 0, v_group_id, NOW(), NOW()
    );

    -- names
    IF v_name_id IS NOT NULL THEN
        IF (names).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).create_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
        IF (names).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_names_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((names).link_tool_id, v_call_id);
            INSERT INTO names_calls_connection (names_id, call_id) VALUES (v_name_id, v_call_id);
        END IF;
    END IF;

    -- descriptions
    IF v_description_id IS NOT NULL THEN
        IF (descriptions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).create_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
        IF (descriptions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_descriptions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((descriptions).link_tool_id, v_call_id);
            INSERT INTO descriptions_calls_connection (descriptions_id, call_id) VALUES (v_description_id, v_call_id);
        END IF;
    END IF;

    -- problem statements
    IF v_problem_statement_id IS NOT NULL THEN
        IF (problem_statements).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).create_tool_id, v_call_id);
            INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id) VALUES (v_problem_statement_id, v_call_id);
        END IF;
        IF (problem_statements).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_problem_statements_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((problem_statements).link_tool_id, v_call_id);
            INSERT INTO problem_statements_calls_connection (problem_statements_id, call_id) VALUES (v_problem_statement_id, v_call_id);
        END IF;
    END IF;

    -- flags
    IF COALESCE(array_length(v_flag_ids, 1), 0) > 0 THEN
        IF (flags).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).create_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT x.flag_id, v_call_id FROM UNNEST(v_flag_ids) AS x(flag_id);
        END IF;
        IF (flags).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_flags_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((flags).link_tool_id, v_call_id);
            INSERT INTO flags_calls_connection (flags_id, call_id)
            SELECT x.flag_id, v_call_id FROM UNNEST(v_flag_ids) AS x(flag_id);
        END IF;
    END IF;

    -- departments
    IF COALESCE(array_length(v_department_ids, 1), 0) > 0 THEN
        IF (departments).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).create_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT x.department_id, v_call_id FROM UNNEST(v_department_ids) AS x(department_id);
        END IF;
        IF (departments).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_departments_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((departments).link_tool_id, v_call_id);
            INSERT INTO departments_calls_connection (departments_id, call_id)
            SELECT x.department_id, v_call_id FROM UNNEST(v_department_ids) AS x(department_id);
        END IF;
    END IF;

    -- personas
    IF COALESCE(array_length(v_persona_ids, 1), 0) > 0 THEN
        IF (personas).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((personas).create_tool_id, v_call_id);
            INSERT INTO personas_calls_connection (personas_id, call_id)
            SELECT x.persona_id, v_call_id FROM UNNEST(v_persona_ids) AS x(persona_id);
        END IF;
        IF (personas).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_personas_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((personas).link_tool_id, v_call_id);
            INSERT INTO personas_calls_connection (personas_id, call_id)
            SELECT x.persona_id, v_call_id FROM UNNEST(v_persona_ids) AS x(persona_id);
        END IF;
    END IF;

    -- documents
    IF COALESCE(array_length(v_document_ids, 1), 0) > 0 THEN
        IF (documents).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).create_tool_id, v_call_id);
            INSERT INTO documents_calls_connection (documents_id, call_id)
            SELECT x.document_id, v_call_id FROM UNNEST(v_document_ids) AS x(document_id);
        END IF;
        IF (documents).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_documents_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((documents).link_tool_id, v_call_id);
            INSERT INTO documents_calls_connection (documents_id, call_id)
            SELECT x.document_id, v_call_id FROM UNNEST(v_document_ids) AS x(document_id);
        END IF;
    END IF;

    -- parameters
    IF COALESCE(array_length(v_parameter_ids, 1), 0) > 0 THEN
        IF (parameters).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).create_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT x.parameter_id, v_call_id FROM UNNEST(v_parameter_ids) AS x(parameter_id);
        END IF;
        IF (parameters).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_parameters_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameters).link_tool_id, v_call_id);
            INSERT INTO parameters_calls_connection (parameters_id, call_id)
            SELECT x.parameter_id, v_call_id FROM UNNEST(v_parameter_ids) AS x(parameter_id);
        END IF;
    END IF;

    -- parameter_fields (payload IDs are field IDs, map to parameter_fields_resource.id)
    IF COALESCE(array_length(v_parameter_field_ids, 1), 0) > 0 THEN
        IF (parameter_fields).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            v_parameter_fields_call_id := v_call_id;
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).create_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT pfr.id, v_call_id
            FROM UNNEST(v_parameter_field_ids) AS x(field_id)
            JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
        END IF;
        IF (parameter_fields).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            v_parameter_fields_call_id := v_call_id;
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_parameter_fields_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((parameter_fields).link_tool_id, v_call_id);
            INSERT INTO parameter_fields_calls_connection (parameter_fields_id, call_id)
            SELECT pfr.id, v_call_id
            FROM UNNEST(v_parameter_field_ids) AS x(field_id)
            JOIN parameter_fields_resource pfr ON pfr.field_id = x.field_id;
        END IF;
    END IF;

    -- images
    IF COALESCE(array_length(v_image_ids, 1), 0) > 0 THEN
        IF (images).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).create_tool_id, v_call_id);
            INSERT INTO images_calls_connection (images_id, call_id)
            SELECT x.image_id, v_call_id FROM UNNEST(v_image_ids) AS x(image_id);
        END IF;
        IF (images).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_images_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((images).link_tool_id, v_call_id);
            INSERT INTO images_calls_connection (images_id, call_id)
            SELECT x.image_id, v_call_id FROM UNNEST(v_image_ids) AS x(image_id);
        END IF;
    END IF;

    -- objectives
    IF COALESCE(array_length(v_objective_ids, 1), 0) > 0 THEN
        IF (objectives).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).create_tool_id, v_call_id);
            INSERT INTO objectives_calls_connection (objectives_id, call_id)
            SELECT x.objective_id, v_call_id FROM UNNEST(v_objective_ids) AS x(objective_id);
        END IF;
        IF (objectives).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_objectives_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((objectives).link_tool_id, v_call_id);
            INSERT INTO objectives_calls_connection (objectives_id, call_id)
            SELECT x.objective_id, v_call_id FROM UNNEST(v_objective_ids) AS x(objective_id);
        END IF;
    END IF;

    -- videos
    IF COALESCE(array_length(v_video_ids, 1), 0) > 0 THEN
        IF (videos).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).create_tool_id, v_call_id);
            INSERT INTO videos_calls_connection (videos_id, call_id)
            SELECT x.video_id, v_call_id FROM UNNEST(v_video_ids) AS x(video_id);
        END IF;
        IF (videos).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_videos_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((videos).link_tool_id, v_call_id);
            INSERT INTO videos_calls_connection (videos_id, call_id)
            SELECT x.video_id, v_call_id FROM UNNEST(v_video_ids) AS x(video_id);
        END IF;
    END IF;

    -- questions
    IF COALESCE(array_length(v_question_ids, 1), 0) > 0 THEN
        IF (questions).create_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_create_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).create_tool_id, v_call_id);
            INSERT INTO questions_calls_connection (questions_id, call_id)
            SELECT x.question_id, v_call_id FROM UNNEST(v_question_ids) AS x(question_id);
        END IF;
        IF (questions).link_tool_id IS NOT NULL THEN
            v_call_id := uuidv7();
            INSERT INTO calls_entry (id, external_call_id, run_id, completed, created_at, updated_at)
            VALUES (v_call_id, 'scenario_save_link_questions_' || v_call_id::text, v_run_id, true, NOW(), NOW());
            INSERT INTO tools_calls_connection (tools_id, call_id) VALUES ((questions).link_tool_id, v_call_id);
            INSERT INTO questions_calls_connection (questions_id, call_id)
            SELECT x.question_id, v_call_id FROM UNNEST(v_question_ids) AS x(question_id);
        END IF;
    END IF;

    -- Link resources (using parameters directly - no draft queries!)
    IF v_name_id IS NOT NULL THEN
        INSERT INTO scenario_names_junction (scenario_id, name_id, active, created_at)
        VALUES (v_scenario_id, v_name_id, true, NOW())
        ON CONFLICT (scenario_id, name_id) DO UPDATE SET active = true;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO scenario_descriptions_junction (scenario_id, description_id, active, created_at)
        VALUES (v_scenario_id, v_description_id, true, NOW())
        ON CONFLICT (scenario_id, description_id) DO UPDATE SET active = true;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_active_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_objectives_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_objectives_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_images_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_images_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_video_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_video_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_questions_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_questions_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_problem_statement_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_problem_statement_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, active = true;
    END IF;

    IF v_department_ids IS NOT NULL THEN
        INSERT INTO scenario_departments_junction (scenario_id, department_id, active, created_at)
        SELECT v_scenario_id, dept_id, true, NOW()
        FROM UNNEST(v_department_ids) as dept_id
        ON CONFLICT (scenario_id, department_id) DO UPDATE SET active = true;
    END IF;

    IF v_persona_ids IS NOT NULL THEN
        INSERT INTO scenario_personas_junction (scenario_id, persona_id, active, created_at)
        SELECT v_scenario_id, persona_id, true, NOW()
        FROM UNNEST(v_persona_ids) as persona_id
        ON CONFLICT (scenario_id, persona_id) DO UPDATE SET active = true;
    END IF;

    IF v_document_ids IS NOT NULL THEN
        INSERT INTO scenario_documents_junction (scenario_id, document_id, active, created_at)
        SELECT v_scenario_id, doc_id, true, NOW()
        FROM UNNEST(v_document_ids) as doc_id
        ON CONFLICT (scenario_id, document_id) DO UPDATE SET active = true;
    END IF;

    IF v_parameter_ids IS NOT NULL THEN
        INSERT INTO scenario_parameters_junction (scenario_id, parameter_id, active, created_at)
        SELECT v_scenario_id, param_id, true, NOW()
        FROM UNNEST(v_parameter_ids) as param_id
        ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET active = true;
    END IF;

    IF v_parameter_field_ids IS NOT NULL THEN
        INSERT INTO scenario_parameter_fields_junction (scenario_id, parameter_field_id, active, created_at)
        SELECT v_scenario_id, pfr.id, true, NOW()
        FROM UNNEST(v_parameter_field_ids) as input_field_id
        JOIN parameter_fields_resource pfr ON pfr.field_id = input_field_id
        ON CONFLICT (scenario_id, parameter_field_id) DO UPDATE SET active = true;
    END IF;

    IF v_image_ids IS NOT NULL THEN
        INSERT INTO scenario_images_junction (scenario_id, image_id, active, created_at)
        SELECT v_scenario_id, image_id, true, NOW()
        FROM UNNEST(v_image_ids) as image_id
        ON CONFLICT (scenario_id, image_id) DO UPDATE SET active = true;
    END IF;

    IF v_objective_ids IS NOT NULL THEN
        INSERT INTO scenario_objectives_junction (scenario_id, objective_id, idx, active, created_at)
        SELECT v_scenario_id, x.objective_id, x.idx, true, NOW()
        FROM UNNEST(v_objective_ids) WITH ORDINALITY AS x(objective_id, idx)
        ON CONFLICT (scenario_id, objective_id) DO UPDATE SET active = true;
    END IF;

    IF v_problem_statement_id IS NOT NULL THEN
        INSERT INTO scenario_problem_statements_junction (scenario_id, problem_statement_id, active, created_at)
        VALUES (v_scenario_id, v_problem_statement_id, true, NOW())
        ON CONFLICT (scenario_id, problem_statement_id) DO UPDATE SET active = true;
    END IF;

    IF v_video_ids IS NOT NULL THEN
        INSERT INTO scenario_videos_junction (scenario_id, video_id, active, created_at)
        SELECT v_scenario_id, video_id, true, NOW()
        FROM UNNEST(v_video_ids) as video_id
        ON CONFLICT (scenario_id, video_id) DO UPDATE SET active = true;
    END IF;

    IF v_question_ids IS NOT NULL THEN
        INSERT INTO scenario_questions_junction (scenario_id, question_id, active, created_at)
        SELECT v_scenario_id, question_id, true, NOW()
        FROM UNNEST(v_question_ids) as question_id
        ON CONFLICT (scenario_id, question_id) DO UPDATE SET active = true;
    END IF;

    -- Persona-style scenario resource workflow:
    -- deactivate old linked scenarios_resource, create new denormalized row, link active.
    UPDATE scenario_scenarios_junction
    SET active = false
    WHERE scenario_id = v_scenario_id
      AND active = true;

    INSERT INTO scenarios_resource (
        name,
        description,
        problem_statement_enabled,
        objectives_enabled,
        video_enabled,
        images_enabled,
        questions_enabled,
        department_ids,
        is_root
    )
    SELECT
        n.name,
        d.description,
        v_problem_statement_enabled_flag_id IS NOT NULL,
        v_objectives_enabled_flag_id IS NOT NULL,
        v_video_enabled_flag_id IS NOT NULL,
        v_images_enabled_flag_id IS NOT NULL,
        v_questions_enabled_flag_id IS NOT NULL,
        v_department_ids,
        is_create  -- new scenarios are root; updates preserve existing tree structure
    FROM (SELECT 1) one
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    RETURNING id INTO v_scenarios_resource_id;

    INSERT INTO scenario_scenarios_junction (scenario_id, scenarios_id, active, created_at)
    VALUES (v_scenario_id, v_scenarios_resource_id, true, NOW());

    INSERT INTO scenarios_calls_connection (scenarios_id, call_id)
    SELECT v_scenarios_resource_id, c.id
    FROM calls_entry c
    WHERE c.run_id = v_run_id
    ON CONFLICT DO NOTHING;

    -- Return saved scenario
    RETURN QUERY
    SELECT
        v_scenario_id,
        COALESCE(
            (SELECT (SELECT n.name FROM profile_names_junction pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id LIMIT 1)
             FROM profile_artifact p
             WHERE p.id = v_profile_id),
            ''
        )::text;
END;
$$;
