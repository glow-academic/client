-- Sync cohort entries — insert-only batch creation of home/practice + chat entries
-- Called after cohort save to pre-create all entry rows with denormalized data.
-- Parameters: cohorts_resource_id, department_ids, profile_ids, profile_persona_ids, simulations[], chats[]

-- Drop function if exists (handles signature variations)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_sync_cohort_entries_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_sync_cohort_entries_v4(%s)', r.sig);
    END LOOP;
END $$;

-- Drop composite types if they exist
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname IN ('i_sync_sim_v4', 'i_sync_chat_v4')
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

-- Simulation-level input composite
CREATE TYPE types.i_sync_sim_v4 AS (
    resource_id uuid,
    practice boolean,
    "position" int,
    start_time timestamptz,
    end_time timestamptz,
    position_resource_ids uuid[],
    availability_resource_ids uuid[]
);

-- Chat-level input composite
CREATE TYPE types.i_sync_chat_v4 AS (
    sim_index int,                    -- 1-based index into p_simulations array
    scenario_id uuid,
    rubric_ids uuid[],                -- resolved rubrics_resource.id values
    "position" int,
    time_limit int,
    negative_time boolean,
    -- 13 scenario flag booleans
    audio_enabled boolean, text_enabled boolean, hints_enabled boolean,
    copy_paste_allowed boolean, show_images boolean, show_objectives boolean,
    show_problem_statement boolean, analyses_enabled boolean,
    improvements_enabled boolean, replacements_enabled boolean,
    strengths_enabled boolean, use_custom boolean, use_previous boolean,
    -- 5 content-enabled booleans
    problem_statement_enabled boolean, objectives_enabled boolean,
    video_enabled boolean, images_enabled boolean, questions_enabled boolean,
    -- 11 generate flags
    generate_problem_statements boolean, generate_objectives boolean,
    generate_videos boolean, generate_images boolean, generate_questions boolean,
    generate_personas boolean, generate_documents boolean, generate_options boolean,
    generate_parameter_fields boolean, generate_names boolean,
    generate_descriptions boolean,
    -- connection resource IDs
    scenario_flag_ids uuid[], scenario_position_ids uuid[],
    scenario_time_limit_ids uuid[], persona_ids uuid[],
    document_ids uuid[], image_ids uuid[], video_ids uuid[],
    question_ids uuid[], option_ids uuid[], problem_statement_ids uuid[],
    objective_ids uuid[], parameter_field_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_sync_cohort_entries_v4(
    p_cohorts_resource_id uuid,
    p_department_ids uuid[],
    p_profile_ids uuid[],
    p_profile_persona_ids uuid[],
    p_simulations types.i_sync_sim_v4[],
    p_chats types.i_sync_chat_v4[]
)
RETURNS TABLE (entry_count int)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_now timestamptz := NOW();
    v_sim record;
    v_chat record;
    v_parent_id uuid;
    v_chat_id uuid;
    v_entry_count int := 0;
    v_dept_id uuid;
    v_profile_id uuid;
    v_persona_id uuid;
    v_pos_id uuid;
    v_avail_id uuid;
    v_rid uuid;
BEGIN
    -- Iterate simulations with ordinal position
    FOR v_sim IN
        SELECT s.*, ordinality AS sim_ord
        FROM UNNEST(p_simulations) WITH ORDINALITY AS s(
            resource_id, practice, "position", start_time, end_time,
            position_resource_ids, availability_resource_ids
        )
    LOOP
        -- Create home_entry or practice_entry
        IF v_sim.practice THEN
            INSERT INTO practice_entry (created_at, "position", start_time, end_time)
            VALUES (v_now, v_sim."position", v_sim.start_time, v_sim.end_time)
            RETURNING id INTO v_parent_id;

            -- practice_cohorts_connection
            INSERT INTO practice_cohorts_connection (practice_id, cohorts_id, created_at)
            VALUES (v_parent_id, p_cohorts_resource_id, v_now);

            -- practice_simulations_connection
            INSERT INTO practice_simulations_connection (practice_id, simulations_id, created_at)
            VALUES (v_parent_id, v_sim.resource_id, v_now);

            -- practice_simulation_positions_connection
            IF v_sim.position_resource_ids IS NOT NULL THEN
                FOREACH v_pos_id IN ARRAY v_sim.position_resource_ids LOOP
                    INSERT INTO practice_simulation_positions_connection (practice_id, simulation_positions_id, created_at)
                    VALUES (v_parent_id, v_pos_id, v_now);
                END LOOP;
            END IF;

            -- practice_simulation_availability_connection
            IF v_sim.availability_resource_ids IS NOT NULL THEN
                FOREACH v_avail_id IN ARRAY v_sim.availability_resource_ids LOOP
                    INSERT INTO practice_simulation_availability_connection (practice_id, simulation_availability_id, created_at)
                    VALUES (v_parent_id, v_avail_id, v_now);
                END LOOP;
            END IF;

            -- practice_departments_connection
            IF p_department_ids IS NOT NULL THEN
                FOREACH v_dept_id IN ARRAY p_department_ids LOOP
                    INSERT INTO practice_departments_connection (practice_id, departments_id, created_at)
                    VALUES (v_parent_id, v_dept_id, v_now);
                END LOOP;
            END IF;

            -- practice_profiles_connection
            IF p_profile_ids IS NOT NULL THEN
                FOREACH v_profile_id IN ARRAY p_profile_ids LOOP
                    INSERT INTO practice_profiles_connection (practice_id, profiles_id, created_at)
                    VALUES (v_parent_id, v_profile_id, v_now);
                END LOOP;
            END IF;

            -- practice_profile_personas_connection
            IF p_profile_persona_ids IS NOT NULL THEN
                FOREACH v_persona_id IN ARRAY p_profile_persona_ids LOOP
                    INSERT INTO practice_profile_personas_connection (practice_id, profile_personas_id, created_at)
                    VALUES (v_parent_id, v_persona_id, v_now);
                END LOOP;
            END IF;
        ELSE
            INSERT INTO home_entry (created_at, "position", start_time, end_time)
            VALUES (v_now, v_sim."position", v_sim.start_time, v_sim.end_time)
            RETURNING id INTO v_parent_id;

            -- home_cohorts_connection
            INSERT INTO home_cohorts_connection (home_id, cohorts_id, created_at)
            VALUES (v_parent_id, p_cohorts_resource_id, v_now);

            -- home_simulations_connection
            INSERT INTO home_simulations_connection (home_id, simulations_id, created_at)
            VALUES (v_parent_id, v_sim.resource_id, v_now);

            -- home_simulation_positions_connection
            IF v_sim.position_resource_ids IS NOT NULL THEN
                FOREACH v_pos_id IN ARRAY v_sim.position_resource_ids LOOP
                    INSERT INTO home_simulation_positions_connection (home_id, simulation_positions_id, created_at)
                    VALUES (v_parent_id, v_pos_id, v_now);
                END LOOP;
            END IF;

            -- home_simulation_availability_connection
            IF v_sim.availability_resource_ids IS NOT NULL THEN
                FOREACH v_avail_id IN ARRAY v_sim.availability_resource_ids LOOP
                    INSERT INTO home_simulation_availability_connection (home_id, simulation_availability_id, created_at)
                    VALUES (v_parent_id, v_avail_id, v_now);
                END LOOP;
            END IF;

            -- home_departments_connection
            IF p_department_ids IS NOT NULL THEN
                FOREACH v_dept_id IN ARRAY p_department_ids LOOP
                    INSERT INTO home_departments_connection (home_id, departments_id, created_at)
                    VALUES (v_parent_id, v_dept_id, v_now);
                END LOOP;
            END IF;

            -- home_profiles_connection
            IF p_profile_ids IS NOT NULL THEN
                FOREACH v_profile_id IN ARRAY p_profile_ids LOOP
                    INSERT INTO home_profiles_connection (home_id, profiles_id, created_at)
                    VALUES (v_parent_id, v_profile_id, v_now);
                END LOOP;
            END IF;

            -- home_profile_personas_connection
            IF p_profile_persona_ids IS NOT NULL THEN
                FOREACH v_persona_id IN ARRAY p_profile_persona_ids LOOP
                    INSERT INTO home_profile_personas_connection (home_id, profile_personas_id, created_at)
                    VALUES (v_parent_id, v_persona_id, v_now);
                END LOOP;
            END IF;
        END IF;

        v_entry_count := v_entry_count + 1;

        -- Now insert chat entries for this simulation
        FOR v_chat IN
            SELECT c.*
            FROM UNNEST(p_chats) AS c(
                sim_index, scenario_id, rubric_ids, "position", time_limit, negative_time,
                audio_enabled, text_enabled, hints_enabled,
                copy_paste_allowed, show_images, show_objectives,
                show_problem_statement, analyses_enabled,
                improvements_enabled, replacements_enabled,
                strengths_enabled, use_custom, use_previous,
                problem_statement_enabled, objectives_enabled,
                video_enabled, images_enabled, questions_enabled,
                generate_problem_statements, generate_objectives,
                generate_videos, generate_images, generate_questions,
                generate_personas, generate_documents, generate_options,
                generate_parameter_fields, generate_names,
                generate_descriptions,
                scenario_flag_ids, scenario_position_ids,
                scenario_time_limit_ids, persona_ids,
                document_ids, image_ids, video_ids,
                question_ids, option_ids, problem_statement_ids,
                objective_ids, parameter_field_ids
            )
            WHERE c.sim_index = v_sim.sim_ord
        LOOP
            -- Insert chat_entry with all denormalized columns
            INSERT INTO chat_entry (
                created_at, "position", time_limit, negative_time,
                audio_enabled, text_enabled, hints_enabled,
                copy_paste_allowed, show_images, show_objectives,
                show_problem_statement, analyses_enabled,
                improvements_enabled, replacements_enabled,
                strengths_enabled, use_custom, use_previous,
                problem_statement_enabled, objectives_enabled,
                video_enabled, images_enabled, questions_enabled,
                generate_problem_statements, generate_objectives,
                generate_videos, generate_images, generate_questions,
                generate_personas, generate_documents, generate_options,
                generate_parameter_fields, generate_names,
                generate_descriptions
            )
            VALUES (
                v_now, v_chat."position", v_chat.time_limit, COALESCE(v_chat.negative_time, false),
                COALESCE(v_chat.audio_enabled, true), COALESCE(v_chat.text_enabled, true),
                COALESCE(v_chat.hints_enabled, true), COALESCE(v_chat.copy_paste_allowed, true),
                COALESCE(v_chat.show_images, true), COALESCE(v_chat.show_objectives, true),
                COALESCE(v_chat.show_problem_statement, true), COALESCE(v_chat.analyses_enabled, true),
                COALESCE(v_chat.improvements_enabled, true), COALESCE(v_chat.replacements_enabled, true),
                COALESCE(v_chat.strengths_enabled, true), COALESCE(v_chat.use_custom, false),
                COALESCE(v_chat.use_previous, false),
                COALESCE(v_chat.problem_statement_enabled, false), COALESCE(v_chat.objectives_enabled, false),
                COALESCE(v_chat.video_enabled, false), COALESCE(v_chat.images_enabled, false),
                COALESCE(v_chat.questions_enabled, false),
                COALESCE(v_chat.generate_problem_statements, false), COALESCE(v_chat.generate_objectives, false),
                COALESCE(v_chat.generate_videos, false), COALESCE(v_chat.generate_images, false),
                COALESCE(v_chat.generate_questions, false),
                COALESCE(v_chat.generate_personas, false), COALESCE(v_chat.generate_documents, false),
                COALESCE(v_chat.generate_options, false),
                COALESCE(v_chat.generate_parameter_fields, false), COALESCE(v_chat.generate_names, false),
                COALESCE(v_chat.generate_descriptions, false)
            )
            RETURNING id INTO v_chat_id;

            -- Bridge: home_chat_entry or practice_chat_entry
            IF v_sim.practice THEN
                INSERT INTO practice_chat_entry (practice_id, chat_id, created_at)
                VALUES (v_parent_id, v_chat_id, v_now);
            ELSE
                INSERT INTO home_chat_entry (home_id, chat_id, created_at)
                VALUES (v_parent_id, v_chat_id, v_now);
            END IF;

            -- chat_scenarios_connection
            INSERT INTO chat_scenarios_connection (chat_id, scenarios_id, created_at)
            VALUES (v_chat_id, v_chat.scenario_id, v_now);

            -- chat_rubrics_connection
            IF v_chat.rubric_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.rubric_ids LOOP
                    INSERT INTO chat_rubrics_connection (chat_id, rubrics_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_scenario_flags_connection
            IF v_chat.scenario_flag_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.scenario_flag_ids LOOP
                    INSERT INTO chat_scenario_flags_connection (chat_id, scenario_flags_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_scenario_positions_connection
            IF v_chat.scenario_position_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.scenario_position_ids LOOP
                    INSERT INTO chat_scenario_positions_connection (chat_id, scenario_positions_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_scenario_time_limits_connection
            IF v_chat.scenario_time_limit_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.scenario_time_limit_ids LOOP
                    INSERT INTO chat_scenario_time_limits_connection (chat_id, scenario_time_limits_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_personas_connection
            IF v_chat.persona_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.persona_ids LOOP
                    INSERT INTO chat_personas_connection (chat_id, personas_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_documents_connection
            IF v_chat.document_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.document_ids LOOP
                    INSERT INTO chat_documents_connection (chat_id, documents_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_images_connection
            IF v_chat.image_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.image_ids LOOP
                    INSERT INTO chat_images_connection (chat_id, images_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_videos_connection
            IF v_chat.video_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.video_ids LOOP
                    INSERT INTO chat_videos_connection (chat_id, videos_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_questions_connection
            IF v_chat.question_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.question_ids LOOP
                    INSERT INTO chat_questions_connection (chat_id, questions_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_options_connection
            IF v_chat.option_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.option_ids LOOP
                    INSERT INTO chat_options_connection (chat_id, options_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_problem_statements_connection
            IF v_chat.problem_statement_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.problem_statement_ids LOOP
                    INSERT INTO chat_problem_statements_connection (chat_id, problem_statements_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_objectives_connection
            IF v_chat.objective_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.objective_ids LOOP
                    INSERT INTO chat_objectives_connection (chat_id, objectives_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            -- chat_parameter_fields_connection
            IF v_chat.parameter_field_ids IS NOT NULL THEN
                FOREACH v_rid IN ARRAY v_chat.parameter_field_ids LOOP
                    INSERT INTO chat_parameter_fields_connection (chat_id, parameter_fields_id, created_at)
                    VALUES (v_chat_id, v_rid, v_now);
                END LOOP;
            END IF;

            v_entry_count := v_entry_count + 1;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT v_entry_count;
END;
$$;
