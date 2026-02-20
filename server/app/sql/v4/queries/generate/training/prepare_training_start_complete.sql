-- Prepare training start - resolves scope and ensures department-scoped bundle.
-- Derives simulation/scenario/training scope from training_entry.
-- Ensures department-scoped bundle exists at runtime (create-if-missing).
-- Chat creation is handled separately by socket_create_attempt_chat_v4.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'socket_prepare_training_start_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS socket_prepare_training_start_v4(%s)', r.sig);
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION socket_prepare_training_start_v4(
    p_profile_id uuid,
    p_chat_entry_id uuid,
    p_department_id uuid,
    p_draft_id uuid DEFAULT NULL
)
RETURNS TABLE (
    chat_resolved_id uuid,
    scenario_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_chat_id uuid;
    v_scenarios_resource_id uuid;
    v_scenario_artifact_id uuid;
    v_simulations_resource_id uuid;
    v_simulation_artifact_id uuid;
    v_cohorts_resource_id uuid;
    v_is_practice boolean := false;

    v_profiles_resource_id uuid;
    v_roles_resource_id uuid;

    v_rubrics_resource_id uuid;
    v_rubric_artifact_id uuid;
    v_personas_resource_id uuid;
    v_problem_statements_resource_id uuid;
    v_selected_department_id uuid;

    v_chat_resolved_id uuid;
    v_config_signature text := 'runtime-v1';
    v_draft_persona_ids uuid[] := ARRAY[]::uuid[];
    v_draft_document_ids uuid[] := ARRAY[]::uuid[];
    v_draft_parameter_field_ids uuid[] := ARRAY[]::uuid[];
BEGIN
    -- Resolve profile resource and optional role.
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
      AND ppj.active = true
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    SELECT prj.role_id INTO v_roles_resource_id
    FROM profile_roles_junction prj
    WHERE prj.profile_id = p_profile_id
      AND prj.active = true
    LIMIT 1;

    -- Resolve training scope from bundle.
    SELECT
        tb.chat_id,
        tb.scenarios_id,
        t.simulations_id,
        t.cohorts_id,
        t.practice,
        (
            SELECT ssj.simulation_id
            FROM simulation_simulations_junction ssj
            WHERE ssj.simulations_id = t.simulations_id
              AND ssj.active = true
            LIMIT 1
        ),
        (
            SELECT scj.scenario_id
            FROM scenario_scenarios_junction scj
            WHERE scj.scenarios_id = tb.scenarios_id
              AND scj.active = true
            LIMIT 1
        )
    INTO
        v_chat_id,
        v_scenarios_resource_id,
        v_simulations_resource_id,
        v_cohorts_resource_id,
        v_is_practice,
        v_simulation_artifact_id,
        v_scenario_artifact_id
    FROM chat_entry tb
    JOIN chat_entry t
      ON t.id = tb.chat_id
     AND t.active = true
    WHERE tb.id = p_chat_entry_id
      AND tb.active = true
    LIMIT 1;

    IF v_chat_id IS NULL THEN
        RAISE EXCEPTION 'Training bundle not found or inactive: %', p_chat_entry_id;
    END IF;

    IF v_simulations_resource_id IS NULL OR v_simulation_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Simulation scope not found for training bundle %', p_chat_entry_id;
    END IF;

    IF v_scenarios_resource_id IS NULL OR v_scenario_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Scenario scope not found for training bundle %', p_chat_entry_id;
    END IF;

    -- Resolve rubric/persona/problem statement from scenario scope.
    SELECT srr.rubric_id, rrj.rubric_id
    INTO v_rubrics_resource_id, v_rubric_artifact_id
    FROM simulation_scenario_rubrics_junction ssrj
    JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
    LEFT JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = srr.rubric_id
    WHERE ssrj.simulation_id = v_simulation_artifact_id
      AND srr.scenario_id = v_scenarios_resource_id
      AND ssrj.active = true
    LIMIT 1;

    SELECT spj.persona_id INTO v_personas_resource_id
    FROM scenario_personas_junction spj
    WHERE spj.scenario_id = v_scenario_artifact_id
      AND spj.active = true
    LIMIT 1;

    SELECT spsj.problem_statement_id INTO v_problem_statements_resource_id
    FROM scenario_problem_statements_junction spsj
    WHERE spsj.scenario_id = v_scenario_artifact_id
      AND spsj.active = true
    LIMIT 1;

    -- Resolve optional draft overrides (scenario-style draft selections).
    IF p_draft_id IS NOT NULL THEN
        SELECT ARRAY_AGG(DISTINCT pdc.personas_id)
        INTO v_draft_persona_ids
        FROM chat_drafts_personas_connection pdc
        WHERE pdc.draft_id = p_draft_id;

        SELECT ARRAY_AGG(DISTINCT ddc.documents_id)
        INTO v_draft_document_ids
        FROM chat_drafts_documents_connection ddc
        WHERE ddc.draft_id = p_draft_id;

        SELECT ARRAY_AGG(DISTINCT pfdc.parameter_fields_id)
        INTO v_draft_parameter_field_ids
        FROM chat_drafts_parameter_fields_connection pfdc
        WHERE pfdc.draft_id = p_draft_id;

        SELECT ddc.departments_id
        INTO v_selected_department_id
        FROM chat_drafts_departments_connection ddc
        WHERE ddc.draft_id = p_draft_id
        ORDER BY ddc.version DESC NULLS LAST
        LIMIT 1;
    END IF;

    v_selected_department_id := COALESCE(v_selected_department_id, p_department_id);

    -- Ensure department-scoped resolved entry exists at runtime.
    SELECT cre.id INTO v_chat_resolved_id
    FROM chat_resolved_entry cre
    WHERE cre.chat_id = p_chat_entry_id
      AND cre.departments_id = v_selected_department_id
      AND cre.active = true
    ORDER BY cre.created_at
    LIMIT 1;

    IF v_chat_resolved_id IS NULL THEN
        INSERT INTO chat_resolved_entry (
            chat_id,
            departments_id,
            config_signature,
            created_at,
            updated_at,
            active,
            generated,
            mcp
        )
        VALUES (
            p_chat_entry_id,
            v_selected_department_id,
            v_config_signature,
            NOW(),
            NOW(),
            true,
            false,
            false
        )
        ON CONFLICT (chat_id, departments_id, config_signature)
        DO UPDATE SET updated_at = NOW(), active = true
        RETURNING id INTO v_chat_resolved_id;
    END IF;

    -- Ensure canonical scope links exist on sub-bundle.
    INSERT INTO chat_resolved_scenarios_connection (
        chat_resolved_id, scenarios_id, created_at, active, generated, mcp
    )
    VALUES (v_chat_resolved_id, v_scenarios_resource_id, NOW(), true, false, false)
    ON CONFLICT (chat_resolved_id, scenarios_id) DO NOTHING;

    INSERT INTO chat_resolved_time_limits_connection (
        chat_resolved_id, scenario_time_limits_id, created_at, active, generated, mcp
    )
    SELECT
        v_chat_resolved_id,
        stlr.id,
        NOW(),
        true,
        false,
        false
    FROM simulation_scenario_time_limits_junction sstl
    JOIN scenario_time_limits_resource stlr
      ON stlr.id = sstl.scenario_time_limit_id
     AND stlr.active = true
    WHERE sstl.simulation_id = v_simulation_artifact_id
      AND sstl.active = true
      AND stlr.scenario_id = v_scenarios_resource_id
    ON CONFLICT (chat_resolved_id, scenario_time_limits_id) DO NOTHING;

    IF COALESCE(array_length(v_draft_persona_ids, 1), 0) > 0 OR v_personas_resource_id IS NOT NULL THEN
        INSERT INTO chat_resolved_personas_connection (
            chat_resolved_id, personas_id, created_at, active, generated, mcp
        )
        SELECT
            v_chat_resolved_id,
            pid,
            NOW(),
            true,
            false,
            false
        FROM unnest(
            CASE
                WHEN COALESCE(array_length(v_draft_persona_ids, 1), 0) > 0 THEN v_draft_persona_ids
                ELSE ARRAY[v_personas_resource_id]::uuid[]
            END
        ) AS pid
        ON CONFLICT (chat_resolved_id, personas_id) DO NOTHING;
    END IF;

    IF v_rubrics_resource_id IS NOT NULL THEN
        INSERT INTO chat_resolved_rubrics_connection (
            chat_resolved_id, rubrics_id, created_at, active, generated, mcp
        )
        VALUES (v_chat_resolved_id, v_rubrics_resource_id, NOW(), true, false, false)
        ON CONFLICT (chat_resolved_id, rubrics_id) DO NOTHING;
    END IF;

    IF v_problem_statements_resource_id IS NOT NULL THEN
        INSERT INTO chat_resolved_problem_statements_connection (
            chat_resolved_id, problem_statements_id, created_at, active, generated, mcp
        )
        VALUES (v_chat_resolved_id, v_problem_statements_resource_id, NOW(), true, false, false)
        ON CONFLICT (chat_resolved_id, problem_statements_id) DO NOTHING;
    END IF;

    INSERT INTO chat_resolved_documents_connection (chat_resolved_id, documents_id, created_at, active, generated, mcp)
    SELECT DISTINCT
        v_chat_resolved_id,
        doc_id,
        NOW(),
        true,
        false,
        false
    FROM (
        SELECT sdj.document_id AS doc_id
        FROM scenario_documents_junction sdj
        WHERE sdj.scenario_id = v_scenario_artifact_id
          AND sdj.active = true
          AND COALESCE(array_length(v_draft_document_ids, 1), 0) = 0
        UNION ALL
        SELECT unnest(v_draft_document_ids)
        WHERE COALESCE(array_length(v_draft_document_ids, 1), 0) > 0
    ) selected_docs
    ON CONFLICT (chat_resolved_id, documents_id) DO NOTHING;

    INSERT INTO chat_resolved_parameter_fields_connection (chat_resolved_id, parameter_fields_id, created_at, active, generated, mcp)
    SELECT DISTINCT
        v_chat_resolved_id,
        field_id,
        NOW(),
        true,
        false,
        false
    FROM (
        SELECT spfj.parameter_field_id AS field_id
        FROM scenario_parameter_fields_junction spfj
        WHERE spfj.scenario_id = v_scenario_artifact_id
          AND spfj.active = true
          AND COALESCE(array_length(v_draft_parameter_field_ids, 1), 0) = 0
        UNION ALL
        SELECT unnest(v_draft_parameter_field_ids)
        WHERE COALESCE(array_length(v_draft_parameter_field_ids, 1), 0) > 0
    ) selected_fields
    ON CONFLICT (chat_resolved_id, parameter_fields_id) DO NOTHING;

    INSERT INTO chat_resolved_objectives_connection (chat_resolved_id, objectives_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_chat_resolved_id, soj.objective_id, NOW(), true, false, false
    FROM scenario_objectives_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (chat_resolved_id, objectives_id) DO NOTHING;

    INSERT INTO chat_resolved_questions_connection (chat_resolved_id, questions_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_chat_resolved_id, sqj.question_id, NOW(), true, false, false
    FROM scenario_questions_junction sqj
    WHERE sqj.scenario_id = v_scenario_artifact_id
      AND sqj.active = true
    ON CONFLICT (chat_resolved_id, questions_id) DO NOTHING;

    INSERT INTO chat_resolved_options_connection (chat_resolved_id, options_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_chat_resolved_id, soj.option_id, NOW(), true, false, false
    FROM scenario_options_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (chat_resolved_id, options_id) DO NOTHING;

    INSERT INTO chat_resolved_videos_connection (chat_resolved_id, videos_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_chat_resolved_id, svj.video_id, NOW(), true, false, false
    FROM scenario_videos_junction svj
    WHERE svj.scenario_id = v_scenario_artifact_id
      AND svj.active = true
    ON CONFLICT (chat_resolved_id, videos_id) DO NOTHING;

    INSERT INTO chat_resolved_images_connection (chat_resolved_id, images_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_chat_resolved_id, sij.image_id, NOW(), true, false, false
    FROM scenario_images_junction sij
    WHERE sij.scenario_id = v_scenario_artifact_id
      AND sij.active = true
    ON CONFLICT (chat_resolved_id, images_id) DO NOTHING;

    IF v_rubric_artifact_id IS NOT NULL THEN
        INSERT INTO chat_resolved_standards_connection (chat_resolved_id, standards_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_chat_resolved_id, rsj.standard_id, NOW(), true, false, false
        FROM rubric_standards_junction rsj
        WHERE rsj.rubric_id = v_rubric_artifact_id
          AND rsj.active = true
        ON CONFLICT (chat_resolved_id, standards_id) DO NOTHING;

        INSERT INTO chat_resolved_standard_groups_connection (chat_resolved_id, standard_groups_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_chat_resolved_id, rsgj.standard_group_id, NOW(), true, false, false
        FROM rubric_standard_groups_junction rsgj
        WHERE rsgj.rubric_id = v_rubric_artifact_id
          AND rsgj.active = true
        ON CONFLICT (chat_resolved_id, standard_groups_id) DO NOTHING;
    END IF;

    RETURN QUERY SELECT v_chat_resolved_id, v_scenario_artifact_id;
END;
$$;
