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
    parameter_ids uuid[] DEFAULT NULL,
    field_ids uuid[] DEFAULT NULL,
    image_ids uuid[] DEFAULT NULL,
    objective_ids uuid[] DEFAULT NULL,
    problem_statement_ids uuid[] DEFAULT NULL,
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
    
    -- Try to update existing draft
    IF input_draft_id IS NOT NULL THEN
        -- Get existing draft's group_id
        SELECT group_id INTO v_group_id FROM drafts WHERE id = input_draft_id;
        
        -- Create group if draft doesn't have one (shouldn't happen after migration, but safety check)
        IF v_group_id IS NULL THEN
            INSERT INTO groups (created_at, updated_at)
            VALUES (NOW(), NOW())
            RETURNING id INTO v_group_id;
        END IF;
        
        UPDATE drafts
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
            DELETE FROM draft_names WHERE draft_names.draft_id = v_draft_id;
            DELETE FROM draft_descriptions WHERE draft_descriptions.draft_id = v_draft_id;
            DELETE FROM draft_flags WHERE draft_flags.draft_id = v_draft_id;
            DELETE FROM draft_departments WHERE draft_departments.draft_id = v_draft_id;
            DELETE FROM draft_personas WHERE draft_personas.draft_id = v_draft_id;
            DELETE FROM draft_documents WHERE draft_documents.draft_id = v_draft_id;
            DELETE FROM draft_parameters WHERE draft_parameters.draft_id = v_draft_id;
            DELETE FROM draft_fields WHERE draft_fields.draft_id = v_draft_id;
            DELETE FROM draft_images WHERE draft_images.draft_id = v_draft_id;
            DELETE FROM draft_objectives WHERE draft_objectives.draft_id = v_draft_id;
            DELETE FROM draft_problem_statements WHERE draft_problem_statements.draft_id = v_draft_id;
            
            -- Insert new resource links
            IF name_id IS NOT NULL THEN
                INSERT INTO draft_names (draft_id, names_id, version)
                VALUES (v_draft_id, name_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF description_id IS NOT NULL THEN
                INSERT INTO draft_descriptions (draft_id, descriptions_id, version)
                VALUES (v_draft_id, description_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_descriptions_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF active_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, active_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF objectives_enabled_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF images_enabled_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF video_enabled_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF questions_enabled_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF problem_statement_enabled_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;

            IF use_templates_flag_id IS NOT NULL THEN
                INSERT INTO draft_flags (draft_id, flags_id, version)
                VALUES (v_draft_id, use_templates_flag_id, v_new_version)
                ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            -- Handle array resources
            IF department_ids IS NOT NULL THEN
                DELETE FROM draft_departments WHERE draft_departments.draft_id = v_draft_id;
                INSERT INTO draft_departments (draft_id, departments_id, version)
                SELECT v_draft_id, dept_id, v_new_version
                FROM UNNEST(department_ids) as dept_id
                ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF persona_ids IS NOT NULL THEN
                DELETE FROM draft_personas WHERE draft_personas.draft_id = v_draft_id;
                INSERT INTO draft_personas (draft_id, personas_id, version)
                SELECT v_draft_id, persona_id, v_new_version
                FROM UNNEST(persona_ids) as persona_id
                ON CONFLICT ON CONSTRAINT draft_personas_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF document_ids IS NOT NULL THEN
                DELETE FROM draft_documents WHERE draft_documents.draft_id = v_draft_id;
                INSERT INTO draft_documents (draft_id, documents_id, version)
                SELECT v_draft_id, doc_id, v_new_version
                FROM UNNEST(document_ids) as doc_id
                ON CONFLICT ON CONSTRAINT draft_documents_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF parameter_ids IS NOT NULL THEN
                DELETE FROM draft_parameters WHERE draft_parameters.draft_id = v_draft_id;
                INSERT INTO draft_parameters (draft_id, parameters_id, version)
                SELECT v_draft_id, param_id, v_new_version
                FROM UNNEST(parameter_ids) as param_id
                ON CONFLICT ON CONSTRAINT draft_parameters_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF field_ids IS NOT NULL THEN
                DELETE FROM draft_fields WHERE draft_fields.draft_id = v_draft_id;
                INSERT INTO draft_fields (draft_id, fields_id, version)
                SELECT v_draft_id, field_id, v_new_version
                FROM UNNEST(field_ids) as field_id
                ON CONFLICT ON CONSTRAINT draft_fields_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF image_ids IS NOT NULL THEN
                DELETE FROM draft_images WHERE draft_images.draft_id = v_draft_id;
                INSERT INTO draft_images (draft_id, images_id, version)
                SELECT v_draft_id, img_id, v_new_version
                FROM UNNEST(image_ids) as img_id
                ON CONFLICT ON CONSTRAINT draft_images_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF objective_ids IS NOT NULL THEN
                DELETE FROM draft_objectives WHERE draft_objectives.draft_id = v_draft_id;
                INSERT INTO draft_objectives (draft_id, objectives_id, version)
                SELECT v_draft_id, obj_id, v_new_version
                FROM UNNEST(objective_ids) as obj_id
                ON CONFLICT ON CONSTRAINT draft_objectives_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            IF problem_statement_ids IS NOT NULL THEN
                DELETE FROM draft_problem_statements WHERE draft_problem_statements.draft_id = v_draft_id;
                INSERT INTO draft_problem_statements (draft_id, problem_statements_id, version)
                SELECT v_draft_id, ps_id, v_new_version
                FROM UNNEST(problem_statement_ids) as ps_id
                ON CONFLICT ON CONSTRAINT draft_problem_statements_pkey DO UPDATE
                SET version = v_new_version,
                    updated_at = now();
            END IF;
            
            RETURN QUERY SELECT v_draft_id, v_new_version, v_draft_exists;
            RETURN;
        END IF;
    END IF;
    
    -- Create new draft with group
    -- First create a group for this draft
    INSERT INTO groups (created_at, updated_at)
    VALUES (NOW(), NOW())
    RETURNING id INTO v_group_id;
    
    -- Create new draft with group_id
    INSERT INTO drafts (artifact, profile_id, group_id)
    VALUES ('scenario'::artifacts, v_profile_id, v_group_id)
    RETURNING id, version INTO v_draft_id, v_new_version;
    
    -- Link resources to draft
    IF name_id IS NOT NULL THEN
        INSERT INTO draft_names (draft_id, names_id, version)
        VALUES (v_draft_id, name_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_names_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF description_id IS NOT NULL THEN
        INSERT INTO draft_descriptions (draft_id, descriptions_id, version)
        VALUES (v_draft_id, description_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_descriptions_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF active_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, active_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF objectives_enabled_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, objectives_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF images_enabled_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, images_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF video_enabled_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, video_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF questions_enabled_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, questions_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF problem_statement_enabled_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, problem_statement_enabled_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;

    IF use_templates_flag_id IS NOT NULL THEN
        INSERT INTO draft_flags (draft_id, flags_id, version)
        VALUES (v_draft_id, use_templates_flag_id, v_new_version)
        ON CONFLICT ON CONSTRAINT draft_flags_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    -- Handle array resources
    IF department_ids IS NOT NULL THEN
        INSERT INTO draft_departments (draft_id, departments_id, version)
        SELECT v_draft_id, dept_id, v_new_version
        FROM UNNEST(department_ids) as dept_id
        ON CONFLICT ON CONSTRAINT draft_departments_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF persona_ids IS NOT NULL THEN
        INSERT INTO draft_personas (draft_id, personas_id, version)
        SELECT v_draft_id, persona_id, v_new_version
        FROM UNNEST(persona_ids) as persona_id
        ON CONFLICT ON CONSTRAINT draft_personas_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF document_ids IS NOT NULL THEN
        INSERT INTO draft_documents (draft_id, documents_id, version)
        SELECT v_draft_id, doc_id, v_new_version
        FROM UNNEST(document_ids) as doc_id
        ON CONFLICT ON CONSTRAINT draft_documents_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF parameter_ids IS NOT NULL THEN
        INSERT INTO draft_parameters (draft_id, parameters_id, version)
        SELECT v_draft_id, param_id, v_new_version
        FROM UNNEST(parameter_ids) as param_id
        ON CONFLICT ON CONSTRAINT draft_parameters_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF field_ids IS NOT NULL THEN
        INSERT INTO draft_fields (draft_id, fields_id, version)
        SELECT v_draft_id, field_id, v_new_version
        FROM UNNEST(field_ids) as field_id
        ON CONFLICT ON CONSTRAINT draft_fields_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF image_ids IS NOT NULL THEN
        INSERT INTO draft_images (draft_id, images_id, version)
        SELECT v_draft_id, img_id, v_new_version
        FROM UNNEST(image_ids) as img_id
        ON CONFLICT ON CONSTRAINT draft_images_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF objective_ids IS NOT NULL THEN
        INSERT INTO draft_objectives (draft_id, objectives_id, version)
        SELECT v_draft_id, obj_id, v_new_version
        FROM UNNEST(objective_ids) as obj_id
        ON CONFLICT ON CONSTRAINT draft_objectives_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    IF problem_statement_ids IS NOT NULL THEN
        INSERT INTO draft_problem_statements (draft_id, problem_statements_id, version)
        SELECT v_draft_id, ps_id, v_new_version
        FROM UNNEST(problem_statement_ids) as ps_id
        ON CONFLICT ON CONSTRAINT draft_problem_statements_pkey DO UPDATE
        SET version = v_new_version,
            updated_at = now();
    END IF;
    
    RETURN QUERY SELECT v_draft_id, v_new_version, false;
END;
$$;
