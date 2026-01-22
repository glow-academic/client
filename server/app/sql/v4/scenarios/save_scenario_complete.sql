-- Unified save scenario function - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)
-- Resource-ID only contract (no text creation)
-- Uses safe drop/recreate pattern: drop function first, then types (no CASCADE), then recreate

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

-- 3) Recreate function
CREATE OR REPLACE FUNCTION api_save_scenario_v4(
    draft_id uuid,
    profile_id uuid,
    input_scenario_id uuid DEFAULT NULL
)
RETURNS TABLE (
    scenario_id uuid,
    actor_name text
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_scenario_id uuid;
    v_actor_name text;
    is_create boolean;
    v_group_id uuid;
    v_draft_id uuid;
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
    v_field_ids uuid[];
    v_image_ids uuid[];
    v_objective_ids uuid[];
    v_video_ids uuid[];
    v_question_ids uuid[];
BEGIN
    v_draft_id := draft_id;
    v_profile_id := profile_id;
    v_input_scenario_id := input_scenario_id;

    IF v_draft_id IS NULL THEN
        RAISE EXCEPTION 'draft_id is required';
    END IF;

    SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = v_draft_id;
    IF v_group_id IS NULL THEN
        RAISE EXCEPTION 'Draft group_id not found: %', v_draft_id;
    END IF;

    SELECT dn.names_id
    INTO v_name_id
    FROM names_draft dn
    WHERE dn.draft_id = v_draft_id
    LIMIT 1;

    SELECT dd.descriptions_id
    INTO v_description_id
    FROM descriptions_draft dd
    WHERE dd.draft_id = v_draft_id
    LIMIT 1;

    SELECT dps.problem_statements_id
    INTO v_problem_statement_id
    FROM problem_statements_draft dps
    WHERE dps.draft_id = v_draft_id
    LIMIT 1;

    SELECT df.flags_id
    INTO v_active_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'active'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_objectives_enabled_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'objectives_enabled'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_images_enabled_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'images_enabled'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_video_enabled_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'video_enabled'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_questions_enabled_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'questions_enabled'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_problem_statement_enabled_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'problem_statement_enabled'
    LIMIT 1;

    SELECT df.flags_id
    INTO v_use_templates_flag_id
    FROM flags_draft df
    JOIN flags_resource f ON f.id = df.flags_id
    WHERE df.draft_id = v_draft_id AND f.name = 'use_templates'
    LIMIT 1;

    SELECT COALESCE(ARRAY_AGG(dd.departments_id ORDER BY dd.created_at), ARRAY[]::uuid[])
    INTO v_department_ids
    FROM departments_draft dd
    WHERE dd.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dp.personas_id ORDER BY dp.created_at), ARRAY[]::uuid[])
    INTO v_persona_ids
    FROM personas_draft dp
    WHERE dp.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dd.documents_id ORDER BY dd.created_at), ARRAY[]::uuid[])
    INTO v_document_ids
    FROM documents_draft dd
    WHERE dd.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dt.templates_id ORDER BY dt.created_at), ARRAY[]::uuid[])
    INTO v_template_document_ids
    FROM templates_draft dt
    WHERE dt.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dp.parameters_id ORDER BY dp.created_at), ARRAY[]::uuid[])
    INTO v_parameter_ids
    FROM parameters_draft dp
    WHERE dp.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(df.fields_id ORDER BY df.created_at), ARRAY[]::uuid[])
    INTO v_field_ids
    FROM fields_draft df
    WHERE df.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(di.images_id ORDER BY di.created_at), ARRAY[]::uuid[])
    INTO v_image_ids
    FROM images_draft di
    WHERE di.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(doj.objectives_id ORDER BY doj.created_at), ARRAY[]::uuid[])
    INTO v_objective_ids
    FROM objectives_draft doj
    WHERE doj.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dv.videos_id ORDER BY dv.created_at), ARRAY[]::uuid[])
    INTO v_video_ids
    FROM videos_draft dv
    WHERE dv.draft_id = v_draft_id;

    SELECT COALESCE(ARRAY_AGG(dq.questions_id ORDER BY dq.created_at), ARRAY[]::uuid[])
    INTO v_question_ids
    FROM questions_draft dq
    WHERE dq.draft_id = v_draft_id;

    -- Determine if create or update
    is_create := (v_input_scenario_id IS NULL);

    -- Create or update scenario_artifact
    IF is_create THEN
        INSERT INTO scenario_artifact (group_id, created_at, updated_at)
        VALUES (v_group_id, NOW(), NOW())
        RETURNING id INTO v_scenario_id;
    ELSE
        v_scenario_id := v_input_scenario_id;
        UPDATE scenario_artifact
        SET updated_at = NOW(),
            group_id = v_group_id
        WHERE id = v_scenario_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Scenario not found: %', v_input_scenario_id;
        END IF;
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
        DELETE FROM scenario_fields_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_images_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_objectives_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_problem_statements_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_videos_junction WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_questions_junction WHERE scenario_id = v_scenario_id;
    END IF;

    -- Link resources
    IF v_name_id IS NOT NULL THEN
        INSERT INTO scenario_names_junction (scenario_id, name_id, created_at, updated_at)
        VALUES (v_scenario_id, v_name_id, NOW(), NOW())
        ON CONFLICT (scenario_id, name_id) DO UPDATE SET updated_at = NOW();
    END IF;

    IF v_description_id IS NOT NULL THEN
        INSERT INTO scenario_descriptions_junction (scenario_id, description_id, created_at, updated_at)
        VALUES (v_scenario_id, v_description_id, NOW(), NOW())
        ON CONFLICT (scenario_id, description_id) DO UPDATE SET updated_at = NOW();
    END IF;

    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_active_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_objectives_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_objectives_enabled_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_images_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_images_enabled_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_video_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_video_enabled_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_questions_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_questions_enabled_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_problem_statement_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_problem_statement_enabled_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_use_templates_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags_junction (scenario_id, flag_id, value, created_at, updated_at)
        VALUES (v_scenario_id, v_use_templates_flag_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
    END IF;

    IF v_department_ids IS NOT NULL THEN
        INSERT INTO scenario_departments_junction (scenario_id, department_id, active, created_at, updated_at)
        SELECT v_scenario_id, dept_id, true, NOW(), NOW()
        FROM UNNEST(v_department_ids) as dept_id
        ON CONFLICT (scenario_id, department_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_persona_ids IS NOT NULL THEN
        INSERT INTO scenario_personas_junction (scenario_id, persona_id, active, created_at, updated_at)
        SELECT v_scenario_id, persona_id, true, NOW(), NOW()
        FROM UNNEST(v_persona_ids) as persona_id
        ON CONFLICT (scenario_id, persona_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_document_ids IS NOT NULL THEN
        INSERT INTO scenario_documents_junction (scenario_id, document_id, active, created_at, updated_at)
        SELECT v_scenario_id, doc_id, true, NOW(), NOW()
        FROM UNNEST(v_document_ids) as doc_id
        ON CONFLICT (scenario_id, document_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_template_document_ids IS NOT NULL THEN
        INSERT INTO scenario_templates_junction (scenario_id, template_id, active, created_at, updated_at)
        SELECT v_scenario_id, template_id, true, NOW(), NOW()
        FROM UNNEST(v_template_document_ids) as template_id
        ON CONFLICT (scenario_id, template_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_parameter_ids IS NOT NULL THEN
        INSERT INTO scenario_parameters_junction (scenario_id, parameter_id, active, created_at, updated_at)
        SELECT v_scenario_id, param_id, true, NOW(), NOW()
        FROM UNNEST(v_parameter_ids) as param_id
        ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_field_ids IS NOT NULL THEN
        INSERT INTO scenario_fields_junction (scenario_id, field_id, active, created_at, updated_at)
        SELECT v_scenario_id, field_id, true, NOW(), NOW()
        FROM UNNEST(v_field_ids) as field_id
        ON CONFLICT (scenario_id, field_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_image_ids IS NOT NULL THEN
        INSERT INTO scenario_images_junction (scenario_id, image_id, active, created_at, updated_at)
        SELECT v_scenario_id, image_id, true, NOW(), NOW()
        FROM UNNEST(v_image_ids) as image_id
        ON CONFLICT (scenario_id, image_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_objective_ids IS NOT NULL THEN
        INSERT INTO scenario_objectives_junction (scenario_id, objective_id, active, created_at, updated_at)
        SELECT v_scenario_id, objective_id, true, NOW(), NOW()
        FROM UNNEST(v_objective_ids) as objective_id
        ON CONFLICT (scenario_id, objective_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_problem_statement_id IS NOT NULL THEN
        INSERT INTO scenario_problem_statements_junction (scenario_id, problem_statement_id, active, created_at, updated_at)
        VALUES (v_scenario_id, v_problem_statement_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, problem_statement_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_video_ids IS NOT NULL THEN
        INSERT INTO scenario_videos_junction (scenario_id, video_id, active, created_at, updated_at)
        SELECT v_scenario_id, video_id, true, NOW(), NOW()
        FROM UNNEST(v_video_ids) as video_id
        ON CONFLICT (scenario_id, video_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

    IF v_question_ids IS NOT NULL THEN
        INSERT INTO scenario_questions_junction (scenario_id, question_id, active, created_at, updated_at)
        SELECT v_scenario_id, question_id, true, NOW(), NOW()
        FROM UNNEST(v_question_ids) as question_id
        ON CONFLICT (scenario_id, question_id) DO UPDATE SET active = true, updated_at = NOW();
    END IF;

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
