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
    out_attempt_chat_id uuid,
    out_scenario_id uuid
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
    v_problem_statements_resource_id uuid;
    v_selected_department_id uuid;

    v_attempt_chat_id uuid;
    v_config_signature text := 'runtime-v1';
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
    -- chat_entry links to parent (home/practice) via home_chat_entry/practice_chat_entry,
    -- scenario via chat_scenarios_connection, simulation/cohort via parent connections.
    SELECT
        tb.id,
        scj_conn.scenarios_id,
        COALESCE(hsc.simulations_id, psc.simulations_id),
        COALESCE(hcc.cohorts_id, pcc.cohorts_id),
        (pte.practice_id IS NOT NULL),
        (
            SELECT ssj.simulation_id
            FROM simulation_simulations_junction ssj
            WHERE ssj.simulations_id = COALESCE(hsc.simulations_id, psc.simulations_id)
              AND ssj.active = true
            LIMIT 1
        ),
        (
            SELECT scj.scenario_id
            FROM scenario_scenarios_junction scj
            WHERE scj.scenarios_id = scj_conn.scenarios_id
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
    LEFT JOIN home_chat_entry hte ON hte.chat_id = tb.id
    LEFT JOIN home_entry he ON he.id = hte.home_id AND he.active = true
    LEFT JOIN practice_chat_entry pte ON pte.chat_id = tb.id
    LEFT JOIN practice_entry pe ON pe.id = pte.practice_id AND pe.active = true
    LEFT JOIN home_simulations_connection hsc ON hsc.home_id = he.id AND hsc.active = true
    LEFT JOIN practice_simulations_connection psc ON psc.practice_id = pe.id AND psc.active = true
    LEFT JOIN home_cohorts_connection hcc ON hcc.home_id = he.id AND hcc.active = true
    LEFT JOIN practice_cohorts_connection pcc ON pcc.practice_id = pe.id AND pcc.active = true
    LEFT JOIN chat_scenarios_connection scj_conn
      ON scj_conn.chat_id = tb.id
     AND scj_conn.active = true
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
    -- v_rubrics_resource_id = scenario_rubrics_resource.id (for attempt_chat_rubrics_connection)
    -- v_rubric_artifact_id = rubric_artifact.id (for standards/standard_groups)
    SELECT srr.id, rrj.rubric_id
    INTO v_rubrics_resource_id, v_rubric_artifact_id
    FROM simulation_scenario_rubrics_junction ssrj
    JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
    LEFT JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = srr.rubric_id
    WHERE ssrj.simulation_id = v_simulation_artifact_id
      AND srr.scenario_id = v_scenarios_resource_id
      AND ssrj.active = true
    LIMIT 1;

    SELECT spsj.problem_statement_id INTO v_problem_statements_resource_id
    FROM scenario_problem_statements_junction spsj
    WHERE spsj.scenario_id = v_scenario_artifact_id
      AND spsj.active = true
    LIMIT 1;

    -- Resolve optional draft overrides (scenario-style draft selections).
    IF p_draft_id IS NOT NULL THEN
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
    SELECT cre.id INTO v_attempt_chat_id
    FROM attempt_chat_entry cre
    WHERE cre.chat_id = p_chat_entry_id
      AND cre.departments_id = v_selected_department_id
      AND cre.active = true
    ORDER BY cre.created_at
    LIMIT 1;

    IF v_attempt_chat_id IS NULL THEN
        INSERT INTO attempt_chat_entry (
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
        RETURNING id INTO v_attempt_chat_id;
    END IF;

    -- Ensure canonical scope links exist on sub-bundle.
    INSERT INTO attempt_chat_scenarios_connection (
        attempt_chat_id, scenarios_id, created_at, active, generated, mcp
    )
    VALUES (v_attempt_chat_id, v_scenarios_resource_id, NOW(), true, false, false)
    ON CONFLICT (attempt_chat_id, scenarios_id) DO NOTHING;

    INSERT INTO attempt_chat_time_limits_connection (
        attempt_chat_id, scenario_time_limits_id, created_at, active, generated, mcp
    )
    SELECT
        v_attempt_chat_id,
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
    ON CONFLICT (attempt_chat_id, scenario_time_limits_id) DO NOTHING;

    IF v_rubrics_resource_id IS NOT NULL THEN
        INSERT INTO attempt_chat_rubrics_connection (
            attempt_chat_id, scenario_rubrics_id, created_at, active, generated, mcp
        )
        VALUES (v_attempt_chat_id, v_rubrics_resource_id, NOW(), true, false, false)
        ON CONFLICT (attempt_chat_id, scenario_rubrics_id) DO NOTHING;
    END IF;

    IF v_problem_statements_resource_id IS NOT NULL THEN
        INSERT INTO attempt_chat_problem_statements_connection (
            attempt_chat_id, problem_statements_id, created_at, active, generated, mcp
        )
        VALUES (v_attempt_chat_id, v_problem_statements_resource_id, NOW(), true, false, false)
        ON CONFLICT (attempt_chat_id, problem_statements_id) DO NOTHING;
    END IF;

    INSERT INTO attempt_chat_documents_connection (attempt_chat_id, documents_id, created_at, active, generated, mcp)
    SELECT DISTINCT
        v_attempt_chat_id,
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
    ON CONFLICT (attempt_chat_id, documents_id) DO NOTHING;

    INSERT INTO attempt_chat_parameter_fields_connection (attempt_chat_id, parameter_fields_id, created_at, active, generated, mcp)
    SELECT DISTINCT
        v_attempt_chat_id,
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
    ON CONFLICT (attempt_chat_id, parameter_fields_id) DO NOTHING;

    INSERT INTO attempt_chat_objectives_connection (attempt_chat_id, objectives_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_attempt_chat_id, soj.objective_id, NOW(), true, false, false
    FROM scenario_objectives_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (attempt_chat_id, objectives_id) DO NOTHING;

    INSERT INTO attempt_chat_questions_connection (attempt_chat_id, questions_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_attempt_chat_id, sqj.question_id, NOW(), true, false, false
    FROM scenario_questions_junction sqj
    WHERE sqj.scenario_id = v_scenario_artifact_id
      AND sqj.active = true
    ON CONFLICT (attempt_chat_id, questions_id) DO NOTHING;

    INSERT INTO attempt_chat_options_connection (attempt_chat_id, options_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_attempt_chat_id, soj.option_id, NOW(), true, false, false
    FROM scenario_options_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (attempt_chat_id, options_id) DO NOTHING;

    INSERT INTO attempt_chat_videos_connection (attempt_chat_id, videos_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_attempt_chat_id, svj.video_id, NOW(), true, false, false
    FROM scenario_videos_junction svj
    WHERE svj.scenario_id = v_scenario_artifact_id
      AND svj.active = true
    ON CONFLICT (attempt_chat_id, videos_id) DO NOTHING;

    INSERT INTO attempt_chat_images_connection (attempt_chat_id, images_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_attempt_chat_id, sij.image_id, NOW(), true, false, false
    FROM scenario_images_junction sij
    WHERE sij.scenario_id = v_scenario_artifact_id
      AND sij.active = true
    ON CONFLICT (attempt_chat_id, images_id) DO NOTHING;

    -- Profile personas from cohort scope
    IF v_cohorts_resource_id IS NOT NULL THEN
        INSERT INTO attempt_chat_profile_personas_connection (
            attempt_chat_id, profile_personas_id, created_at, active, generated, mcp
        )
        SELECT DISTINCT
            v_attempt_chat_id,
            ppr.id,
            NOW(),
            true,
            false,
            false
        FROM cohort_cohorts_junction ccj
        JOIN cohort_profile_personas_junction cpj
          ON cpj.cohort_id = ccj.cohort_id AND cpj.active = true
        JOIN profile_personas_resource ppr
          ON ppr.id = cpj.profile_persona_id AND ppr.active = true
        WHERE ccj.cohorts_id = v_cohorts_resource_id
          AND ccj.active = true
          AND ppr.profile_id = v_profiles_resource_id
        ON CONFLICT (attempt_chat_id, profile_personas_id) DO NOTHING;
    END IF;

    IF v_rubric_artifact_id IS NOT NULL THEN
        INSERT INTO attempt_chat_standards_connection (attempt_chat_id, standards_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_attempt_chat_id, rsj.standard_id, NOW(), true, false, false
        FROM rubric_standards_junction rsj
        WHERE rsj.rubric_id = v_rubric_artifact_id
          AND rsj.active = true
        ON CONFLICT (attempt_chat_id, standards_id) DO NOTHING;

        INSERT INTO attempt_chat_standard_groups_connection (attempt_chat_id, standard_groups_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_attempt_chat_id, rsgj.standard_group_id, NOW(), true, false, false
        FROM rubric_standard_groups_junction rsgj
        WHERE rsgj.rubric_id = v_rubric_artifact_id
          AND rsgj.active = true
        ON CONFLICT (attempt_chat_id, standard_groups_id) DO NOTHING;
    END IF;

    RETURN QUERY SELECT v_attempt_chat_id AS out_attempt_chat_id, v_scenario_artifact_id AS out_scenario_id;
END;
$$;
