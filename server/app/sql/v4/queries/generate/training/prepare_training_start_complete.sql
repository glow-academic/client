-- Prepare training start - creates attempt + chat entries.
-- Derives simulation/scenario/training scope from training_bundle_entry.
-- Ensures department-scoped bundle exists at runtime (create-if-missing).

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
    p_training_bundle_entry_id uuid,
    p_department_id uuid,
    p_infinite_mode boolean DEFAULT NULL
)
RETURNS TABLE (
    attempt_id uuid,
    chat_id uuid,
    scenario_id uuid
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_attempt_id uuid;
    v_chat_id uuid;
    v_training_id uuid;
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

    v_training_bundle_department_id uuid;
    v_config_signature text := 'runtime-v1';

    v_session_id uuid;
    v_group_id uuid;
    v_trace_id text;
    v_config_id uuid;
    v_entry RECORD;
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
        tb.training_id,
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
        v_training_id,
        v_scenarios_resource_id,
        v_simulations_resource_id,
        v_cohorts_resource_id,
        v_is_practice,
        v_simulation_artifact_id,
        v_scenario_artifact_id
    FROM training_bundle_entry tb
    JOIN training_entry t
      ON t.id = tb.training_id
     AND t.active = true
    WHERE tb.id = p_training_bundle_entry_id
      AND tb.active = true
    LIMIT 1;

    IF v_training_id IS NULL THEN
        RAISE EXCEPTION 'Training bundle not found or inactive: %', p_training_bundle_entry_id;
    END IF;

    IF v_simulations_resource_id IS NULL OR v_simulation_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Simulation scope not found for training bundle %', p_training_bundle_entry_id;
    END IF;

    IF v_scenarios_resource_id IS NULL OR v_scenario_artifact_id IS NULL THEN
        RAISE EXCEPTION 'Scenario scope not found for training bundle %', p_training_bundle_entry_id;
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

    -- Ensure department-scoped bundle exists at runtime.
    SELECT tbd.id INTO v_training_bundle_department_id
    FROM training_bundle_departments_entry tbd
    WHERE tbd.training_bundle_id = p_training_bundle_entry_id
      AND tbd.departments_id = p_department_id
      AND tbd.active = true
    ORDER BY tbd.created_at
    LIMIT 1;

    IF v_training_bundle_department_id IS NULL THEN
        INSERT INTO training_bundle_departments_entry (
            training_bundle_id,
            departments_id,
            config_signature,
            created_at,
            updated_at,
            active,
            generated,
            mcp
        )
        VALUES (
            p_training_bundle_entry_id,
            p_department_id,
            v_config_signature,
            NOW(),
            NOW(),
            true,
            false,
            false
        )
        ON CONFLICT (training_bundle_id, departments_id, config_signature)
        DO UPDATE SET updated_at = NOW(), active = true
        RETURNING id INTO v_training_bundle_department_id;
    END IF;

    -- Ensure canonical scope links exist on sub-bundle.
    INSERT INTO training_bundle_departments_scenarios_connection (
        training_bundle_department_id, scenarios_id, created_at, active, generated, mcp
    )
    VALUES (v_training_bundle_department_id, v_scenarios_resource_id, NOW(), true, false, false)
    ON CONFLICT (training_bundle_department_id, scenarios_id) DO NOTHING;

    INSERT INTO training_bundle_departments_time_limits_connection (
        training_bundle_department_id, scenario_time_limits_id, created_at, active, generated, mcp
    )
    SELECT
        v_training_bundle_department_id,
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
    ON CONFLICT (training_bundle_department_id, scenario_time_limits_id) DO NOTHING;

    IF v_personas_resource_id IS NOT NULL THEN
        INSERT INTO training_bundle_departments_personas_connection (
            training_bundle_department_id, personas_id, created_at, active, generated, mcp
        )
        VALUES (v_training_bundle_department_id, v_personas_resource_id, NOW(), true, false, false)
        ON CONFLICT (training_bundle_department_id, personas_id) DO NOTHING;
    END IF;

    IF v_rubrics_resource_id IS NOT NULL THEN
        INSERT INTO training_bundle_departments_rubrics_connection (
            training_bundle_department_id, rubrics_id, created_at, active, generated, mcp
        )
        VALUES (v_training_bundle_department_id, v_rubrics_resource_id, NOW(), true, false, false)
        ON CONFLICT (training_bundle_department_id, rubrics_id) DO NOTHING;
    END IF;

    IF v_problem_statements_resource_id IS NOT NULL THEN
        INSERT INTO training_bundle_departments_problem_statements_connection (
            training_bundle_department_id, problem_statements_id, created_at, active, generated, mcp
        )
        VALUES (v_training_bundle_department_id, v_problem_statements_resource_id, NOW(), true, false, false)
        ON CONFLICT (training_bundle_department_id, problem_statements_id) DO NOTHING;
    END IF;

    INSERT INTO training_bundle_departments_documents_connection (training_bundle_department_id, documents_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, sdj.document_id, NOW(), true, false, false
    FROM scenario_documents_junction sdj
    WHERE sdj.scenario_id = v_scenario_artifact_id
      AND sdj.active = true
    ON CONFLICT (training_bundle_department_id, documents_id) DO NOTHING;

    INSERT INTO training_bundle_departments_parameter_fields_connection (training_bundle_department_id, parameter_fields_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, spfj.parameter_field_id, NOW(), true, false, false
    FROM scenario_parameter_fields_junction spfj
    WHERE spfj.scenario_id = v_scenario_artifact_id
      AND spfj.active = true
    ON CONFLICT (training_bundle_department_id, parameter_fields_id) DO NOTHING;

    INSERT INTO training_bundle_departments_objectives_connection (training_bundle_department_id, objectives_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, soj.objective_id, NOW(), true, false, false
    FROM scenario_objectives_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (training_bundle_department_id, objectives_id) DO NOTHING;

    INSERT INTO training_bundle_departments_questions_connection (training_bundle_department_id, questions_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, sqj.question_id, NOW(), true, false, false
    FROM scenario_questions_junction sqj
    WHERE sqj.scenario_id = v_scenario_artifact_id
      AND sqj.active = true
    ON CONFLICT (training_bundle_department_id, questions_id) DO NOTHING;

    INSERT INTO training_bundle_departments_options_connection (training_bundle_department_id, options_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, soj.option_id, NOW(), true, false, false
    FROM scenario_options_junction soj
    WHERE soj.scenario_id = v_scenario_artifact_id
      AND soj.active = true
    ON CONFLICT (training_bundle_department_id, options_id) DO NOTHING;

    INSERT INTO training_bundle_departments_templates_connection (training_bundle_department_id, templates_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, stj.template_id, NOW(), true, false, false
    FROM scenario_templates_junction stj
    WHERE stj.scenario_id = v_scenario_artifact_id
      AND stj.active = true
    ON CONFLICT (training_bundle_department_id, templates_id) DO NOTHING;

    INSERT INTO training_bundle_departments_videos_connection (training_bundle_department_id, videos_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, svj.video_id, NOW(), true, false, false
    FROM scenario_videos_junction svj
    WHERE svj.scenario_id = v_scenario_artifact_id
      AND svj.active = true
    ON CONFLICT (training_bundle_department_id, videos_id) DO NOTHING;

    INSERT INTO training_bundle_departments_images_connection (training_bundle_department_id, images_id, created_at, active, generated, mcp)
    SELECT DISTINCT v_training_bundle_department_id, sij.image_id, NOW(), true, false, false
    FROM scenario_images_junction sij
    WHERE sij.scenario_id = v_scenario_artifact_id
      AND sij.active = true
    ON CONFLICT (training_bundle_department_id, images_id) DO NOTHING;

    IF v_rubric_artifact_id IS NOT NULL THEN
        INSERT INTO training_bundle_departments_standards_connection (training_bundle_department_id, standards_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_training_bundle_department_id, rsj.standard_id, NOW(), true, false, false
        FROM rubric_standards_junction rsj
        WHERE rsj.rubric_id = v_rubric_artifact_id
          AND rsj.active = true
        ON CONFLICT (training_bundle_department_id, standards_id) DO NOTHING;

        INSERT INTO training_bundle_departments_standard_groups_connection (training_bundle_department_id, standard_groups_id, created_at, active, generated, mcp)
        SELECT DISTINCT v_training_bundle_department_id, rsgj.standard_group_id, NOW(), true, false, false
        FROM rubric_standard_groups_junction rsgj
        WHERE rsgj.rubric_id = v_rubric_artifact_id
          AND rsgj.active = true
        ON CONFLICT (training_bundle_department_id, standard_groups_id) DO NOTHING;
    END IF;

    -- Create attempt entry.
    INSERT INTO simulation_attempts_entry (created_at, updated_at, practice, infinite_mode, training_id)
    VALUES (NOW(), NOW(), v_is_practice, COALESCE(p_infinite_mode, false), v_training_id)
    RETURNING id INTO v_attempt_id;

    INSERT INTO simulation_attempts_simulations_connection (simulations_id, attempt_id, active)
    VALUES (v_simulations_resource_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, simulations_id) DO NOTHING;

    INSERT INTO simulation_attempts_profiles_connection (profiles_id, attempt_id, active)
    VALUES (v_profiles_resource_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, profiles_id) DO NOTHING;

    IF v_cohorts_resource_id IS NOT NULL THEN
        INSERT INTO simulation_attempts_cohorts_connection (cohorts_id, attempt_id, active)
        VALUES (v_cohorts_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, cohorts_id) DO NOTHING;
    END IF;

    INSERT INTO simulation_attempts_departments_connection (departments_id, attempt_id, active)
    VALUES (p_department_id, v_attempt_id, true)
    ON CONFLICT (attempt_id, departments_id) DO NOTHING;

    IF v_roles_resource_id IS NOT NULL THEN
        INSERT INTO simulation_attempts_roles_connection (roles_id, attempt_id, active)
        VALUES (v_roles_resource_id, v_attempt_id, true)
        ON CONFLICT (attempt_id, roles_id) DO NOTHING;
    END IF;

    -- Create chat entry.
    INSERT INTO simulation_chats_entry (attempt_id, created_at, updated_at, title, training_bundle_department_id)
    VALUES (v_attempt_id, NOW(), NOW(), 'Chat', v_training_bundle_department_id)
    RETURNING id INTO v_chat_id;

    -- Chat scope now resolves from training_bundle_department_id via mv_simulation_chats.

    -- Create per-entry config snapshots by resolving agents server-side.
    SELECT id INTO v_session_id
    FROM sessions_entry
    WHERE profile_id = p_profile_id
      AND active = true
    ORDER BY created_at DESC
    LIMIT 1;

    FOR v_entry IN
        SELECT *
        FROM socket_resolve_attempt_entries_v4(
            p_profile_id,
            ARRAY['contents', 'hints', 'grades', 'feedbacks']::text[]
        )
    LOOP
        IF v_entry.agent_id IS NULL THEN
            CONTINUE;
        END IF;

        INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), v_session_id)
        RETURNING id, trace_id INTO v_group_id, v_trace_id;

        UPDATE simulation_chats_entry
        SET group_id = v_group_id
        WHERE id = v_chat_id;

        INSERT INTO config_entry (created_at, updated_at, generated, mcp, active)
        VALUES (NOW(), NOW(), false, false, true)
        RETURNING id INTO v_config_id;

        INSERT INTO config_agents_connection (config_id, agents_id, created_at, active, generated, mcp)
        SELECT v_config_id, aaj.agents_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
        ON CONFLICT (config_id, agents_id) DO NOTHING;

        INSERT INTO config_models_connection (config_id, models_id, created_at, active, generated, mcp)
        SELECT v_config_id, ar.model_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        JOIN agents_resource ar ON ar.id = aaj.agents_id
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
          AND ar.model_id IS NOT NULL
        ON CONFLICT (config_id, models_id) DO NOTHING;

        INSERT INTO config_providers_connection (config_id, providers_id, created_at, active, generated, mcp)
        SELECT v_config_id, mr.provider_id, NOW(), true, false, false
        FROM agent_agents_junction aaj
        JOIN agents_resource ar ON ar.id = aaj.agents_id
        JOIN models_resource mr ON mr.id = ar.model_id
        WHERE aaj.agent_id = v_entry.agent_id
          AND aaj.active = true
          AND mr.provider_id IS NOT NULL
        ON CONFLICT (config_id, providers_id) DO NOTHING;
    END LOOP;

    RETURN QUERY SELECT v_attempt_id, v_chat_id, v_scenario_artifact_id;
END;
$$;
