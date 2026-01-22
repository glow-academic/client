-- Patch scenario draft - accepts resource IDs and creates/updates draft
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
        WHERE proname = 'api_patch_scenario_draft_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_patch_scenario_draft_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION api_patch_scenario_draft_v4(
    profile_id uuid,
    input_draft_id uuid DEFAULT NULL,
    name_id uuid DEFAULT NULL,
    description_id uuid DEFAULT NULL,
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
    problem_statement_id uuid DEFAULT NULL,
    video_ids uuid[] DEFAULT NULL,
    question_ids uuid[] DEFAULT NULL,
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
    v_group_id uuid;
BEGIN
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

    IF use_templates_flag_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM flags_resource WHERE id = use_templates_flag_id) THEN
        RAISE EXCEPTION 'Flag resource not found: %', use_templates_flag_id;
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
        SELECT group_id INTO v_group_id FROM drafts_entry WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups_entry (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts_entry
        SET version = drafts.version + 1,
            updated_at = now(),
            group_id = COALESCE(group_id, v_group_id)
        WHERE id = input_draft_id
          AND drafts.profile_id = v_profile_id
          AND drafts.version = expected_version
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        IF v_draft_id IS NOT NULL THEN
            v_draft_exists := true;
            
            -- Delete old resource links
            DELETE FROM names_draft WHERE names_draft.draft_id = v_draft_id;
            DELETE FROM descriptions_draft WHERE descriptions_draft.draft_id = v_draft_id;
            DELETE FROM flags_draft WHERE flags_draft.draft_id = v_draft_id;
            DELETE FROM departments_draft WHERE departments_draft.draft_id = v_draft_id;
            DELETE FROM personas_draft WHERE personas_draft.draft_id = v_draft_id;
            DELETE FROM documents_draft WHERE documents_draft.draft_id = v_draft_id;
            DELETE FROM templates_draft WHERE templates_draft.draft_id = v_draft_id;
            DELETE FROM parameters_draft WHERE parameters_draft.draft_id = v_draft_id;
            DELETE FROM fields_draft WHERE fields_draft.draft_id = v_draft_id;
            DELETE FROM images_draft WHERE images_draft.draft_id = v_draft_id;
            DELETE FROM objectives_draft WHERE objectives_draft.draft_id = v_draft_id;
            DELETE FROM problem_statements_draft WHERE problem_statements_draft.draft_id = v_draft_id;
            DELETE FROM videos_draft WHERE videos_draft.draft_id = v_draft_id;
            DELETE FROM questions_draft WHERE questions_draft.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO names_draft (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF objectives_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF images_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF video_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF questions_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF problem_statement_enabled_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF use_templates_flag_id IS NOT NULL THEN
                INSERT INTO flags_draft (draft_id, flags_id, version)
                VALUES (v_draft_id, use_templates_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF department_ids IS NOT NULL THEN
                INSERT INTO departments_draft (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM unnest(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF persona_ids IS NOT NULL THEN
                INSERT INTO personas_draft (draft_id, personas_id, version)
                SELECT v_draft_id, persona_id, v_new_version
                FROM unnest(persona_ids) as persona_id
                ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF document_ids IS NOT NULL THEN
                INSERT INTO documents_draft (draft_id, documents_id, version)
                SELECT v_draft_id, doc_id, v_new_version
                FROM unnest(document_ids) as doc_id
                ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF template_document_ids IS NOT NULL THEN
                INSERT INTO templates_draft (draft_id, templates_id, version)
                SELECT v_draft_id, template_id, v_new_version
                FROM unnest(template_document_ids) as template_id
                ON CONFLICT ON CONSTRAINT templates_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF parameter_ids IS NOT NULL THEN
                INSERT INTO parameters_draft (draft_id, parameters_id, version)
                SELECT v_draft_id, param_id, v_new_version
                FROM unnest(parameter_ids) as param_id
                ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF field_ids IS NOT NULL THEN
                INSERT INTO fields_draft (draft_id, fields_id, version)
                SELECT v_draft_id, field_id, v_new_version
                FROM unnest(field_ids) as field_id
                ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF image_ids IS NOT NULL THEN
                INSERT INTO images_draft (draft_id, images_id, version)
                SELECT v_draft_id, image_id, v_new_version
                FROM unnest(image_ids) as image_id
                ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF objective_ids IS NOT NULL THEN
                INSERT INTO objectives_draft (draft_id, objectives_id, version)
                SELECT v_draft_id, objective_id, v_new_version
                FROM unnest(objective_ids) as objective_id
                ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF problem_statement_id IS NOT NULL THEN
                INSERT INTO problem_statements_draft (draft_id, problem_statements_id, version)
                VALUES (v_draft_id, problem_statement_id, v_new_version)
                ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF video_ids IS NOT NULL THEN
                INSERT INTO videos_draft (draft_id, videos_id, version)
                SELECT v_draft_id, video_id, v_new_version
                FROM unnest(video_ids) as video_id
                ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF question_ids IS NOT NULL THEN
                INSERT INTO questions_draft (draft_id, questions_id, version)
                SELECT v_draft_id, question_id, v_new_version
                FROM unnest(question_ids) as question_id
                ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
        END IF;
    END IF;
    
    -- Create new draft if update failed or input_draft_id was NULL
    IF v_draft_id IS NULL THEN
        -- Create new group for draft
        INSERT INTO groups_entry (created_at, updated_at)
        VALUES (NOW(), NOW())
        RETURNING id INTO v_group_id;

        -- Create draft
        INSERT INTO drafts_entry (artifact, profile_id, group_id)
        VALUES ('scenario'::artifact_type, v_profile_id, v_group_id)
        RETURNING id, version INTO v_draft_id, v_new_version;
        
        v_draft_exists := false;
        
        -- Insert resource links for new draft
        IF name_id IS NOT NULL THEN
            INSERT INTO names_draft (draft_id, names_id, version)
            VALUES (v_draft_id, name_id, v_new_version)
            ON CONFLICT ON CONSTRAINT names_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;
        
        IF description_id IS NOT NULL THEN
            INSERT INTO descriptions_draft (draft_id, descriptions_id, version)
            VALUES (v_draft_id, description_id, v_new_version)
            ON CONFLICT ON CONSTRAINT descriptions_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;
        
        IF active_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, active_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF objectives_enabled_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF images_enabled_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF video_enabled_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF questions_enabled_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF problem_statement_enabled_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF use_templates_flag_id IS NOT NULL THEN
            INSERT INTO flags_draft (draft_id, flags_id, version)
            VALUES (v_draft_id, use_templates_flag_id, v_new_version)
            ON CONFLICT ON CONSTRAINT flags_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF department_ids IS NOT NULL THEN
            INSERT INTO departments_draft (draft_id, departments_id, version)
            SELECT v_draft_id, dept_id, v_new_version
            FROM unnest(department_ids) as dept_id
            ON CONFLICT ON CONSTRAINT departments_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF persona_ids IS NOT NULL THEN
            INSERT INTO personas_draft (draft_id, personas_id, version)
            SELECT v_draft_id, persona_id, v_new_version
            FROM unnest(persona_ids) as persona_id
            ON CONFLICT ON CONSTRAINT personas_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF document_ids IS NOT NULL THEN
            INSERT INTO documents_draft (draft_id, documents_id, version)
            SELECT v_draft_id, doc_id, v_new_version
            FROM unnest(document_ids) as doc_id
            ON CONFLICT ON CONSTRAINT documents_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF template_document_ids IS NOT NULL THEN
            INSERT INTO templates_draft (draft_id, templates_id, version)
            SELECT v_draft_id, template_id, v_new_version
            FROM unnest(template_document_ids) as template_id
            ON CONFLICT ON CONSTRAINT templates_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF parameter_ids IS NOT NULL THEN
            INSERT INTO parameters_draft (draft_id, parameters_id, version)
            SELECT v_draft_id, param_id, v_new_version
            FROM unnest(parameter_ids) as param_id
            ON CONFLICT ON CONSTRAINT parameters_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF field_ids IS NOT NULL THEN
            INSERT INTO fields_draft (draft_id, fields_id, version)
            SELECT v_draft_id, field_id, v_new_version
            FROM unnest(field_ids) as field_id
            ON CONFLICT ON CONSTRAINT fields_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF image_ids IS NOT NULL THEN
            INSERT INTO images_draft (draft_id, images_id, version)
            SELECT v_draft_id, image_id, v_new_version
            FROM unnest(image_ids) as image_id
            ON CONFLICT ON CONSTRAINT images_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF objective_ids IS NOT NULL THEN
            INSERT INTO objectives_draft (draft_id, objectives_id, version)
            SELECT v_draft_id, objective_id, v_new_version
            FROM unnest(objective_ids) as objective_id
            ON CONFLICT ON CONSTRAINT objectives_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF problem_statement_id IS NOT NULL THEN
            INSERT INTO problem_statements_draft (draft_id, problem_statements_id, version)
            VALUES (v_draft_id, problem_statement_id, v_new_version)
            ON CONFLICT ON CONSTRAINT problem_statements_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF video_ids IS NOT NULL THEN
            INSERT INTO videos_draft (draft_id, videos_id, version)
            SELECT v_draft_id, video_id, v_new_version
            FROM unnest(video_ids) as video_id
            ON CONFLICT ON CONSTRAINT videos_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;

        IF question_ids IS NOT NULL THEN
            INSERT INTO questions_draft (draft_id, questions_id, version)
            SELECT v_draft_id, question_id, v_new_version
            FROM unnest(question_ids) as question_id
            ON CONFLICT ON CONSTRAINT questions_draft_pkey DO UPDATE
            SET version = v_new_version,
                updated_at = now();
        END IF;
    END IF;

    RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
END $$;
