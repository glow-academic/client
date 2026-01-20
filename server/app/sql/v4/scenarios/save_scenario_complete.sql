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
    profile_id uuid,
    name_id uuid,
    description_id uuid DEFAULT NULL,
    problem_statement_id uuid DEFAULT NULL,
    active_flag_id uuid DEFAULT NULL,
    objectives_enabled_flag_id uuid DEFAULT NULL,
    images_enabled_flag_id uuid DEFAULT NULL,
    video_enabled_flag_id uuid DEFAULT NULL,
    questions_enabled_flag_id uuid DEFAULT NULL,
    problem_statement_enabled_flag_id uuid DEFAULT NULL,
    use_templates_flag_id uuid DEFAULT NULL,
    department_ids uuid[] DEFAULT NULL,
    persona_ids uuid[] DEFAULT NULL,
    document_ids uuid[] DEFAULT NULL,
    template_document_ids uuid[] DEFAULT NULL,
    parameter_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    image_ids uuid[] DEFAULT NULL,
    objective_ids uuid[] DEFAULT NULL,
    video_ids uuid[] DEFAULT NULL,
    question_ids uuid[] DEFAULT NULL,
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
    v_active_flag_id uuid;
    v_objectives_enabled_flag_id uuid;
    v_images_enabled_flag_id uuid;
    v_video_enabled_flag_id uuid;
    v_questions_enabled_flag_id uuid;
    v_problem_statement_enabled_flag_id uuid;
    v_use_templates_flag_id uuid;
BEGIN
    -- Determine if create or update
    is_create := (input_scenario_id IS NULL);

    -- Create or update scenario_artifact
    IF is_create THEN
        INSERT INTO scenario_artifact (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_scenario_id;
    ELSE
        v_scenario_id := input_scenario_id;
        UPDATE scenario_artifact
        SET updated_at = NOW()
        WHERE id = v_scenario_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Scenario not found: %', input_scenario_id;
        END IF;
    END IF;

    -- Validate required resource IDs exist (single-select resources)
    IF name_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM names_resource WHERE id = name_id) THEN
        RAISE EXCEPTION 'Name resource not found: %', name_id;
    END IF;

    IF description_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM descriptions_resource WHERE id = description_id) THEN
        RAISE EXCEPTION 'Description resource not found: %', description_id;
    END IF;

    IF problem_statement_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM problem_statements_resource WHERE id = problem_statement_id) THEN
        RAISE EXCEPTION 'Problem statement resource not found: %', problem_statement_id;
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

    IF use_templates_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = use_templates_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', use_templates_flag_id;
    END IF;

    -- Resolve canonical flag IDs by name
    SELECT id INTO v_active_flag_id FROM flags_resource WHERE name = 'active' LIMIT 1;
    SELECT id INTO v_objectives_enabled_flag_id FROM flags_resource WHERE name = 'objectives_enabled' LIMIT 1;
    SELECT id INTO v_images_enabled_flag_id FROM flags_resource WHERE name = 'images_enabled' LIMIT 1;
    SELECT id INTO v_video_enabled_flag_id FROM flags_resource WHERE name = 'video_enabled' LIMIT 1;
    SELECT id INTO v_questions_enabled_flag_id FROM flags_resource WHERE name = 'questions_enabled' LIMIT 1;
    SELECT id INTO v_problem_statement_enabled_flag_id FROM flags_resource WHERE name = 'problem_statement_enabled' LIMIT 1;
    SELECT id INTO v_use_templates_flag_id FROM flags_resource WHERE name = 'use_templates' LIMIT 1;

    -- Ensure provided flag IDs match expected names (if provided)
    IF active_flag_id IS NOT NULL AND v_active_flag_id IS NOT NULL AND active_flag_id != v_active_flag_id THEN
        RAISE EXCEPTION 'Active flag ID does not match expected resource';
    END IF;

    IF objectives_enabled_flag_id IS NOT NULL AND v_objectives_enabled_flag_id IS NOT NULL AND objectives_enabled_flag_id != v_objectives_enabled_flag_id THEN
        RAISE EXCEPTION 'Objectives enabled flag ID does not match expected resource';
    END IF;

    IF images_enabled_flag_id IS NOT NULL AND v_images_enabled_flag_id IS NOT NULL AND images_enabled_flag_id != v_images_enabled_flag_id THEN
        RAISE EXCEPTION 'Images enabled flag ID does not match expected resource';
    END IF;

    IF video_enabled_flag_id IS NOT NULL AND v_video_enabled_flag_id IS NOT NULL AND video_enabled_flag_id != v_video_enabled_flag_id THEN
        RAISE EXCEPTION 'Video enabled flag ID does not match expected resource';
    END IF;

    IF questions_enabled_flag_id IS NOT NULL AND v_questions_enabled_flag_id IS NOT NULL AND questions_enabled_flag_id != v_questions_enabled_flag_id THEN
        RAISE EXCEPTION 'Questions enabled flag ID does not match expected resource';
    END IF;

    IF problem_statement_enabled_flag_id IS NOT NULL AND v_problem_statement_enabled_flag_id IS NOT NULL AND problem_statement_enabled_flag_id != v_problem_statement_enabled_flag_id THEN
        RAISE EXCEPTION 'Problem statement enabled flag ID does not match expected resource';
    END IF;

    IF use_templates_flag_id IS NOT NULL AND v_use_templates_flag_id IS NOT NULL AND use_templates_flag_id != v_use_templates_flag_id THEN
        RAISE EXCEPTION 'Use templates flag ID does not match expected resource';
    END IF;

    -- For update: remove old links first
    IF NOT is_create THEN
        DELETE FROM scenario_names WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_descriptions WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_flags WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_departments WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_personas WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_documents WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_templates WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_parameters WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_fields WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_images WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_objectives WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_problem_statements WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_videos WHERE scenario_id = v_scenario_id;
        DELETE FROM scenario_questions WHERE scenario_id = v_scenario_id;
    END IF;

    -- Link resources
    IF name_id IS NOT NULL THEN
        INSERT INTO scenario_names (scenario_id, name_id, created_at, updated_at)
        VALUES (v_scenario_id, name_id, NOW(), NOW())
        ON CONFLICT (scenario_id, name_id) DO UPDATE SET updated_at = NOW();
    END IF;

    IF description_id IS NOT NULL THEN
        INSERT INTO scenario_descriptions (scenario_id, description_id, created_at, updated_at)
        VALUES (v_scenario_id, description_id, NOW(), NOW())
        ON CONFLICT (scenario_id, description_id) DO UPDATE SET updated_at = NOW();
    END IF;

    -- Scenario flags (always insert known flags with true/false values)
    IF v_active_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_active_flag_id, active_flag_id IS NOT NULL, active_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_objectives_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_objectives_enabled_flag_id, objectives_enabled_flag_id IS NOT NULL, objectives_enabled_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_images_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_images_enabled_flag_id, images_enabled_flag_id IS NOT NULL, images_enabled_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_video_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_video_enabled_flag_id, video_enabled_flag_id IS NOT NULL, video_enabled_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_questions_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_questions_enabled_flag_id, questions_enabled_flag_id IS NOT NULL, questions_enabled_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_problem_statement_enabled_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_problem_statement_enabled_flag_id, problem_statement_enabled_flag_id IS NOT NULL, problem_statement_enabled_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    IF v_use_templates_flag_id IS NOT NULL THEN
        INSERT INTO scenario_flags (scenario_id, flag_id, value, active, generated, mcp, created_at, updated_at)
        VALUES (v_scenario_id, v_use_templates_flag_id, use_templates_flag_id IS NOT NULL, use_templates_flag_id IS NOT NULL, false, false, NOW(), NOW())
        ON CONFLICT (scenario_id, flag_id) DO UPDATE SET
            value = EXCLUDED.value,
            active = EXCLUDED.active,
            updated_at = NOW();
    END IF;

    -- Multi-select links
    INSERT INTO scenario_departments (scenario_id, department_id, active, created_at, updated_at)
    SELECT v_scenario_id, dept_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(department_ids, ARRAY[]::uuid[])) as dept_id
    ON CONFLICT (scenario_id, department_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_personas (scenario_id, persona_id, active, created_at, updated_at)
    SELECT v_scenario_id, persona_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(persona_ids, ARRAY[]::uuid[])) as persona_id
    ON CONFLICT (scenario_id, persona_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_documents (scenario_id, document_id, active, created_at, updated_at)
    SELECT v_scenario_id, doc_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(document_ids, ARRAY[]::uuid[])) as doc_id
    ON CONFLICT (scenario_id, document_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_templates (scenario_id, template_id, active, created_at, updated_at)
    SELECT v_scenario_id, template_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(template_document_ids, ARRAY[]::uuid[])) as template_id
    ON CONFLICT (scenario_id, template_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_parameters (scenario_id, parameter_id, active, created_at, updated_at)
    SELECT v_scenario_id, param_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(parameter_ids, ARRAY[]::uuid[])) as param_id
    ON CONFLICT (scenario_id, parameter_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_fields (scenario_id, field_id, active, created_at, updated_at)
    SELECT v_scenario_id, field_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(field_ids, ARRAY[]::uuid[])) as field_id
    ON CONFLICT (scenario_id, field_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_images (scenario_id, image_id, active, created_at, updated_at)
    SELECT v_scenario_id, image_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(image_ids, ARRAY[]::uuid[])) as image_id
    ON CONFLICT (scenario_id, image_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_objectives (scenario_id, objective_id, idx, active, created_at, updated_at)
    SELECT v_scenario_id, obj_id, (ord - 1), true, NOW(), NOW()
    FROM UNNEST(COALESCE(objective_ids, ARRAY[]::uuid[])) WITH ORDINALITY as obj(obj_id, ord)
    ON CONFLICT (scenario_id, objective_id) DO UPDATE SET
        idx = EXCLUDED.idx,
        active = true,
        updated_at = NOW();

    IF problem_statement_id IS NOT NULL THEN
        INSERT INTO scenario_problem_statements (scenario_id, problem_statement_id, active, created_at, updated_at)
        VALUES (v_scenario_id, problem_statement_id, true, NOW(), NOW())
        ON CONFLICT (scenario_id, problem_statement_id) DO UPDATE SET
            active = true,
            updated_at = NOW();
    END IF;

    INSERT INTO scenario_videos (scenario_id, video_id, active, created_at, updated_at)
    SELECT v_scenario_id, video_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(video_ids, ARRAY[]::uuid[])) as video_id
    ON CONFLICT (scenario_id, video_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    INSERT INTO scenario_questions (scenario_id, question_id, active, created_at, updated_at)
    SELECT v_scenario_id, question_id, true, NOW(), NOW()
    FROM UNNEST(COALESCE(question_ids, ARRAY[]::uuid[])) as question_id
    ON CONFLICT (scenario_id, question_id) DO UPDATE SET
        active = true,
        updated_at = NOW();

    -- Insert self-referencing edge in scenario_tree (root)
    INSERT INTO scenario_tree (parent_id, child_id, active)
    VALUES (v_scenario_id, v_scenario_id, true)
    ON CONFLICT (parent_id, child_id) DO NOTHING;

    -- Actor name for audit/context
    SELECT
        COALESCE(
            (SELECT n.name FROM profile_names pn JOIN names_resource n ON pn.name_id = n.id WHERE pn.profile_id = p.id AND pn.type = 'first' LIMIT 1) || ' ' ||
            (SELECT n2.name FROM profile_names pn2 JOIN names_resource n2 ON pn2.name_id = n2.id WHERE pn2.profile_id = p.id AND pn2.type = 'last' LIMIT 1),
            ''
        )
    INTO v_actor_name
    FROM profile_artifact p
    WHERE p.id = profile_id;

    RETURN QUERY SELECT v_scenario_id, v_actor_name;
END $$;
