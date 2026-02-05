-- Prepare training start - creates attempt + chat entries
-- Does NOT create a run - that happens on first message

-- 1) Drop function first
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

-- 2) Create the function
CREATE OR REPLACE FUNCTION socket_prepare_training_start_v4(
    p_profile_id uuid,
    p_simulation_id uuid,
    p_scenario_id uuid DEFAULT NULL
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
    v_scenario_artifact_id uuid;
    v_simulation_artifact_id uuid;
    v_rubric_artifact_id uuid;
    -- Resource IDs for attempt connections
    v_profiles_resource_id uuid;
    v_simulations_resource_id uuid;
    v_cohorts_resource_id uuid;
    v_departments_resource_id uuid;
    v_roles_resource_id uuid;
    -- Resource IDs for chat connections
    v_scenarios_resource_id uuid;
    v_personas_resource_id uuid;
    v_rubrics_resource_id uuid;
    v_problem_statements_resource_id uuid;
    v_rec RECORD;
BEGIN
    -- Look up profiles_resource ID from profile_artifact ID
    SELECT ppj.profiles_id INTO v_profiles_resource_id
    FROM profile_profiles_junction ppj
    WHERE ppj.profile_id = p_profile_id
    LIMIT 1;

    IF v_profiles_resource_id IS NULL THEN
        RAISE EXCEPTION 'Profile resource not found for profile_id %', p_profile_id;
    END IF;

    -- Look up cohorts_resource ID from profile
    SELECT ccj.cohorts_id INTO v_cohorts_resource_id
    FROM profile_cohorts_junction pcj
    JOIN cohort_cohorts_junction ccj ON ccj.cohort_id = pcj.cohort_id
    WHERE pcj.profile_id = p_profile_id AND pcj.active = true
    LIMIT 1;

    -- Look up departments_resource ID from profile (prefer primary department)
    SELECT pdj.department_id INTO v_departments_resource_id
    FROM profile_departments_junction pdj
    WHERE pdj.profile_id = p_profile_id AND pdj.active = true
    ORDER BY pdj.is_primary DESC
    LIMIT 1;

    -- Look up roles_resource ID from profile
    SELECT prj.role_id INTO v_roles_resource_id
    FROM profile_roles_junction prj
    WHERE prj.profile_id = p_profile_id AND prj.active = true
    LIMIT 1;

    -- p_simulation_id is a simulation_artifact ID (from /training/get)
    v_simulation_artifact_id := p_simulation_id;

    -- Resolve simulation resource ID for connection tables
    SELECT ssj.simulations_id INTO v_simulations_resource_id
    FROM simulation_simulations_junction ssj
    WHERE ssj.simulation_id = p_simulation_id AND ssj.active = true
    LIMIT 1;

    -- Get first scenario if not specified
    -- NOTE: simulation_scenarios_junction.scenario_id is actually a scenarios_resource.id
    IF p_scenario_id IS NULL THEN
        SELECT ss.scenario_id INTO v_scenarios_resource_id
        FROM simulation_scenarios_junction ss
        LEFT JOIN simulation_scenario_positions_junction ssp ON ssp.simulation_id = ss.simulation_id
        LEFT JOIN scenario_positions_resource spr ON spr.id = ssp.scenario_position_id
        WHERE ss.simulation_id = v_simulation_artifact_id
          AND ss.active = true
        ORDER BY COALESCE(spr.value, 999999) ASC
        LIMIT 1;
    ELSE
        -- p_scenario_id is assumed to be scenarios_resource.id
        v_scenarios_resource_id := p_scenario_id;
    END IF;

    -- Look up scenario_artifact ID from scenarios_resource ID
    -- (needed for scenario_*_junction tables which use artifact IDs)
    IF v_scenarios_resource_id IS NOT NULL THEN
        SELECT ssj.scenario_id INTO v_scenario_artifact_id
        FROM scenario_scenarios_junction ssj
        WHERE ssj.scenarios_id = v_scenarios_resource_id
        LIMIT 1;
    END IF;

    -- Look up personas_resource ID from scenario (already resource ID in junction)
    SELECT spj.persona_id INTO v_personas_resource_id
    FROM scenario_personas_junction spj
    WHERE spj.scenario_id = v_scenario_artifact_id AND spj.active = true
    LIMIT 1;

    -- Look up problem_statements_resource ID from scenario (already resource ID)
    SELECT spsj.problem_statement_id INTO v_problem_statements_resource_id
    FROM scenario_problem_statements_junction spsj
    WHERE spsj.scenario_id = v_scenario_artifact_id AND spsj.active = true
    LIMIT 1;

    -- Look up rubric: simulation_artifact → scenario_rubrics_resource
    -- NOTE: scenario_rubrics_resource.scenario_id is a scenarios_resource.id
    -- NOTE: scenario_rubrics_resource.rubric_id is already a rubrics_resource.id (not artifact!)
    SELECT srr.rubric_id, rrj.rubric_id INTO v_rubrics_resource_id, v_rubric_artifact_id
    FROM simulation_scenario_rubrics_junction ssrj
    JOIN scenario_rubrics_resource srr ON srr.id = ssrj.scenario_rubric_id
    LEFT JOIN rubric_rubrics_junction rrj ON rrj.rubrics_id = srr.rubric_id
    WHERE ssrj.simulation_id = v_simulation_artifact_id
      AND srr.scenario_id = v_scenarios_resource_id
      AND ssrj.active = true
    LIMIT 1;

    -- Create attempt entry
    INSERT INTO simulation_attempts_entry (created_at, updated_at, practice)
    VALUES (NOW(), NOW(), false)
    RETURNING id INTO v_attempt_id;

    -- Link attempt to simulation (using resolved resource ID)
    INSERT INTO simulation_attempts_simulations_connection (simulations_id, attempt_id, active)
    VALUES (v_simulations_resource_id, v_attempt_id, true);

    -- Link attempt to profile (using resource ID)
    INSERT INTO simulation_attempts_profiles_connection (profiles_id, attempt_id, active)
    VALUES (v_profiles_resource_id, v_attempt_id, true);

    -- Link attempt to cohort (if profile has cohort)
    IF v_cohorts_resource_id IS NOT NULL THEN
        INSERT INTO simulation_attempts_cohorts_connection (cohorts_id, attempt_id, active)
        VALUES (v_cohorts_resource_id, v_attempt_id, true);
    END IF;

    -- Link attempt to department (if profile has department)
    IF v_departments_resource_id IS NOT NULL THEN
        INSERT INTO simulation_attempts_departments_connection (departments_id, attempt_id, active)
        VALUES (v_departments_resource_id, v_attempt_id, true);
    END IF;

    -- Link attempt to role (if profile has role)
    IF v_roles_resource_id IS NOT NULL THEN
        INSERT INTO simulation_attempts_roles_connection (roles_id, attempt_id, active)
        VALUES (v_roles_resource_id, v_attempt_id, true);
    END IF;

    -- Create chat entry (chat has attempt_id directly)
    INSERT INTO simulation_chats_entry (attempt_id, created_at, updated_at, title)
    VALUES (v_attempt_id, NOW(), NOW(), 'Chat')
    RETURNING id INTO v_chat_id;

    -- Link chat to scenario (using resource ID)
    IF v_scenarios_resource_id IS NOT NULL THEN
        INSERT INTO simulation_chats_scenarios_connection (scenarios_id, chat_id, active)
        VALUES (v_scenarios_resource_id, v_chat_id, true);
    END IF;

    -- Link chat to persona (already resource ID)
    IF v_personas_resource_id IS NOT NULL THEN
        INSERT INTO simulation_chats_personas_connection (personas_id, chat_id, active)
        VALUES (v_personas_resource_id, v_chat_id, true);
    END IF;

    -- Link chat to rubric
    IF v_rubrics_resource_id IS NOT NULL THEN
        INSERT INTO simulation_chats_rubrics_connection (rubrics_id, chat_id, active)
        VALUES (v_rubrics_resource_id, v_chat_id, true);
    END IF;

    -- Link chat to problem statement
    IF v_problem_statements_resource_id IS NOT NULL THEN
        INSERT INTO simulation_chats_problem_statements_connection (problem_statements_id, chat_id, active)
        VALUES (v_problem_statements_resource_id, v_chat_id, true);
    END IF;

    -- Link chat to documents from scenario (already resource IDs)
    INSERT INTO simulation_chats_documents_connection (documents_id, chat_id, active)
    SELECT sdj.document_id, v_chat_id, true
    FROM scenario_documents_junction sdj
    WHERE sdj.scenario_id = v_scenario_artifact_id AND sdj.active = true;

    -- Link chat to parameter_fields from scenario (already resource IDs)
    INSERT INTO simulation_chats_parameter_fields_connection (parameter_fields_id, chat_id, active)
    SELECT spfj.parameter_field_id, v_chat_id, true
    FROM scenario_parameter_fields_junction spfj
    WHERE spfj.scenario_id = v_scenario_artifact_id AND spfj.active = true;

    -- Link chat to standards from rubric (already resource IDs)
    IF v_rubric_artifact_id IS NOT NULL THEN
        INSERT INTO simulation_chats_standards_connection (standards_id, chat_id, active)
        SELECT rsj.standard_id, v_chat_id, true
        FROM rubric_standards_junction rsj
        WHERE rsj.rubric_id = v_rubric_artifact_id AND rsj.active = true;

        -- Link chat to standard_groups from rubric (already resource IDs)
        INSERT INTO simulation_chats_standard_groups_connection (standard_groups_id, chat_id, active)
        SELECT rsgj.standard_group_id, v_chat_id, true
        FROM rubric_standard_groups_junction rsgj
        WHERE rsgj.rubric_id = v_rubric_artifact_id AND rsgj.active = true;
    END IF;

    RETURN QUERY SELECT v_attempt_id, v_chat_id, v_scenario_artifact_id;
END;
$$;
