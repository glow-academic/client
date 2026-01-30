-- Unified save scenario function - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)
-- Resource-ID only contract (no text creation)
-- Accepts form fields directly (no draft_id dependency)

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
    group_id uuid,
    input_scenario_id uuid DEFAULT NULL,
    -- Required form data
    name_id uuid DEFAULT NULL,
    -- Optional single-select form data
    description_id uuid DEFAULT NULL,
    problem_statement_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    objectives_enabled_flag_id uuid DEFAULT NULL,
    images_enabled_flag_id uuid DEFAULT NULL,
    video_enabled_flag_id uuid DEFAULT NULL,
    questions_enabled_flag_id uuid DEFAULT NULL,
    problem_statement_enabled_flag_id uuid DEFAULT NULL,
    use_templates_flag_id uuid DEFAULT NULL,
    -- Optional multi-select form data
    department_ids uuid[] DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    template_document_ids uuid[] DEFAULT NULL,
    parameter_ids uuid[] DEFAULT NULL,
    parameter_field_ids uuid[] DEFAULT NULL,
    image_ids uuid[] DEFAULT NULL,
    objective_ids uuid[] DEFAULT NULL,
    video_ids uuid[] DEFAULT NULL,
    question_ids uuid[] DEFAULT NULL
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
    v_use_templates_flag_id uuid;
    v_department_ids uuid[];
    v_persona_ids uuid[];
    v_document_ids uuid[];
    v_template_document_ids uuid[];
    v_parameter_ids uuid[];
    v_parameter_field_ids uuid[];
    v_image_ids uuid[];
    v_objective_ids uuid[];
    v_video_ids uuid[];
    v_question_ids uuid[];
BEGIN
    -- Assign parameters to local variables
    v_profile_id := profile_id;
    v_group_id := group_id;
    v_input_scenario_id := input_scenario_id;
    v_name_id := name_id;
    v_description_id := description_id;
    v_problem_statement_id := problem_statement_id;
    v_active_flag_id := active_flag_id;
    v_objectives_enabled_flag_id := objectives_enabled_flag_id;
    v_images_enabled_flag_id := images_enabled_flag_id;
    v_video_enabled_flag_id := video_enabled_flag_id;
    v_questions_enabled_flag_id := questions_enabled_flag_id;
    v_problem_statement_enabled_flag_id := problem_statement_enabled_flag_id;
    v_use_templates_flag_id := use_templates_flag_id;
    v_department_ids := COALESCE(department_ids, ARRAY[]::uuid[]);
    v_persona_ids := COALESCE(persona_ids, ARRAY[]::uuid[]);
    v_document_ids := COALESCE(document_ids, ARRAY[]::uuid[]);
    v_template_document_ids := COALESCE(template_document_ids, ARRAY[]::uuid[]);
    v_parameter_ids := COALESCE(parameter_ids, ARRAY[]::uuid[]);
    v_parameter_field_ids := COALESCE(parameter_field_ids, ARRAY[]::uuid[]);
    v_image_ids := COALESCE(image_ids, ARRAY[]::uuid[]);
    v_objective_ids := COALESCE(objective_ids, ARRAY[]::uuid[]);
    v_video_ids := COALESCE(video_ids, ARRAY[]::uuid[]);
    v_question_ids := COALESCE(question_ids, ARRAY[]::uuid[]);

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
        -- Link group via junction table
        INSERT INTO scenario_groups_junction (scenario_id, group_id)
        VALUES (v_scenario_id, v_group_id)
        ON CONFLICT DO NOTHING;
        -- Insert root tree edge so scenario appears in the list
        INSERT INTO scenario_tree_junction (parent_id, child_id, active, created_at)
        VALUES (v_scenario_id, v_scenario_id, true, NOW());
    ELSE
        v_scenario_id := v_input_scenario_id;

        -- Check if scenario exists BEFORE attempting update
        IF NOT EXISTS (SELECT 1 FROM scenario_artifact WHERE id = v_scenario_id) THEN
            RAISE EXCEPTION 'Scenario not found: %', v_input_scenario_id;
        END IF;

        UPDATE scenario_artifact
        SET updated_at = NOW()
        WHERE id = v_scenario_id;

        -- Upsert group via junction table
        INSERT INTO scenario_groups_junction (scenario_id, group_id)
        VALUES (v_scenario_id, v_group_id)
        ON CONFLICT DO NOTHING;
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

    IF v_use_templates_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = v_use_templates_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', v_use_templates_flag_id;
    END IF;

    -- For update: remove old links first
    IF NOT is_create THEN
        DELETE FROM scenario_names_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_descriptions_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_flags_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_departments_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_personas_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_documents_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_templates_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_parameters_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_parameter_fields_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_images_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_objectives_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_problem_statements_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_videos_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_questions_junction WHERE scenario_id = v_scenario_id;
    END IF;

    -- Link resources (using parameters directly - no draft queries!)
    IF v_name_id IS NOT NULL THEN
        INSERT INTO scenario_names_junction (scenario_id, name_id, created_at)
        VALUES (v_scenario_id, v_name_id, NOW())
        ON CONFLICT (scenario_id, name_id) DO NOTHING;
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO scenario_descriptions_junction (scenario_id, description_id, created_at)
        VALUES (v_scenario_id, v_description_id, NOW())
        ON CONFLICT (scenario_id, description_id) DO NOTHING;
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_active_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_objectives_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_objectives_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_images_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_images_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_video_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_video_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_questions_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_questions_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_problem_statement_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_problem_statement_enabled_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
    END IF;

    IF v_use_templates_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at)
        VALUES (v_scenario_id, v_use_templates_flag_id, true, NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value;
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

    IF v_template_document_ids IS NOT NULL THEN
        INSERT INTO scenario_templates_junction (scenario_id, template_id, active, created_at)
        SELECT v_scenario_id, template_id, true, NOW()
        FROM UNNEST(v_template_document_ids) as template_id
        ON CONFLICT (scenario_id, template_id) DO UPDATE SET active = true;
    END IF;

    IF v_parameter_ids IS NOT NULL THEN
        INSERT INTO scenario_parameters_junction (scenario_id, parameter_id, active, created_at)
        SELECT v_scenario_id, param_id, true, NOW()
        FROM UNNEST(v_parameter_ids) as param_id
        ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET active = true;
    END IF;

    IF v_parameter_field_ids IS NOT NULL THEN
        INSERT INTO scenario_parameter_fields_junction (scenario_id, parameter_field_id, active, call_id, created_at)
        SELECT v_scenario_id, pfr.id, true, (SELECT id FROM view_calls_entry LIMIT 1), NOW()
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
        INSERT INTO scenario_objectives_junction (scenario_id, objective_id, active, created_at)
        SELECT v_scenario_id, objective_id, true, NOW()
        FROM UNNEST(v_objective_ids) as objective_id
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

    -- Sync linked resources with name/description
    UPDATE scenarios_resource r
    SET name = n.name,
        description = d.description
    FROM scenario_scenarios_junction j
    LEFT JOIN names_resource n ON n.id = v_name_id
    LEFT JOIN descriptions_resource d ON d.id = v_description_id
    WHERE j.scenarios_id = r.id
      AND j.scenario_id = v_scenario_id;

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
