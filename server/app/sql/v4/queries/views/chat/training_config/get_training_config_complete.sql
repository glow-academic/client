-- ============================================================================
-- Query: get_training_config
-- Purpose: Fetch training department config by training_department_ids
-- Section: VIEWS/CHAT/TRAINING_CONFIG
--
-- Replaces the subbundle_snapshot CTE from attempt_chat_mv.
-- Returns config flags + resource ID arrays per training_department_id.
-- ============================================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oidvectortypes(proargtypes) as sig
        FROM pg_proc
        WHERE proname = 'api_get_training_config_v4'
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS api_get_training_config_v4(%s)', r.sig);
    END LOOP;
END $$;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT typname
        FROM pg_type
        WHERE typname LIKE 'q_get_training_config_v4_%'
          AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'types')
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS types.%I CASCADE', r.typname);
    END LOOP;
END $$;

CREATE TYPE types.q_get_training_config_v4_item AS (
    training_department_id uuid,
    -- Config flags
    copy_paste_allowed boolean,
    text_enabled boolean,
    audio_enabled boolean,
    hints_enabled boolean,
    show_images boolean,
    show_objectives boolean,
    show_problem_statement boolean,
    time_limit_seconds int,
    negative boolean,
    -- Singular picks
    scenario_id uuid,
    rubric_id uuid,
    problem_statement_id uuid,
    -- Plural sets
    persona_ids uuid[],
    objective_ids uuid[],
    question_ids uuid[],
    option_ids uuid[],
    image_ids uuid[],
    video_ids uuid[],
    document_ids uuid[],
    standard_group_ids uuid[],
    standard_ids uuid[]
);

CREATE OR REPLACE FUNCTION api_get_training_config_v4(
    training_department_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_training_config_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH config AS (
        SELECT
            tbd.id AS training_department_id,
            COALESCE(he.copy_paste_allowed, pe.copy_paste_allowed, true) AS copy_paste_allowed,
            COALESCE(he.text_enabled, pe.text_enabled, true) AS text_enabled,
            COALESCE(he.audio_enabled, pe.audio_enabled, true) AS audio_enabled,
            COALESCE(he.hints_enabled, pe.hints_enabled, true) AS hints_enabled,
            COALESCE(he.show_images, pe.show_images, true) AS show_images,
            COALESCE(he.show_objectives, pe.show_objectives, true) AS show_objectives,
            COALESCE(he.show_problem_statement, pe.show_problem_statement, true) AS show_problem_statement,
            COALESCE(MAX(stlr.time_limit_seconds), 0)::int AS time_limit_seconds,
            COALESCE(BOOL_OR(stlr.negative), false) AS negative,
            -- singular picks (first by created_at)
            (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at) FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
            (ARRAY_AGG(trc.scenario_rubrics_id ORDER BY trc.created_at) FILTER (WHERE trc.scenario_rubrics_id IS NOT NULL))[1] AS rubric_id,
            (ARRAY_AGG(tpsc.problem_statements_id ORDER BY tpsc.created_at) FILTER (WHERE tpsc.problem_statements_id IS NOT NULL))[1] AS problem_statement_id,
            -- plural sets
            COALESCE(ARRAY_AGG(DISTINCT tpc.scenario_personas_id ORDER BY tpc.scenario_personas_id) FILTER (WHERE tpc.scenario_personas_id IS NOT NULL), ARRAY[]::uuid[]) AS persona_ids,
            COALESCE(ARRAY_AGG(DISTINCT toc.objectives_id ORDER BY toc.objectives_id) FILTER (WHERE toc.objectives_id IS NOT NULL), ARRAY[]::uuid[]) AS objective_ids,
            COALESCE(ARRAY_AGG(DISTINCT tqc.questions_id ORDER BY tqc.questions_id) FILTER (WHERE tqc.questions_id IS NOT NULL), ARRAY[]::uuid[]) AS question_ids,
            COALESCE(ARRAY_AGG(DISTINCT topt.options_id ORDER BY topt.options_id) FILTER (WHERE topt.options_id IS NOT NULL), ARRAY[]::uuid[]) AS option_ids,
            COALESCE(ARRAY_AGG(DISTINCT tic.images_id ORDER BY tic.images_id) FILTER (WHERE tic.images_id IS NOT NULL), ARRAY[]::uuid[]) AS image_ids,
            COALESCE(ARRAY_AGG(DISTINCT tvc.videos_id ORDER BY tvc.videos_id) FILTER (WHERE tvc.videos_id IS NOT NULL), ARRAY[]::uuid[]) AS video_ids,
            COALESCE(ARRAY_AGG(DISTINCT tdc.documents_id ORDER BY tdc.documents_id) FILTER (WHERE tdc.documents_id IS NOT NULL), ARRAY[]::uuid[]) AS document_ids,
            COALESCE(ARRAY_AGG(DISTINCT tsgc.standard_groups_id ORDER BY tsgc.standard_groups_id) FILTER (WHERE tsgc.standard_groups_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_group_ids,
            COALESCE(ARRAY_AGG(DISTINCT tsc2.standards_id ORDER BY tsc2.standards_id) FILTER (WHERE tsc2.standards_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_ids
        FROM training_department_entry tbd
        JOIN training_entry tb ON tb.id = tbd.training_id
        LEFT JOIN home_training_entry hte ON hte.training_id = tb.id
        LEFT JOIN home_entry he ON he.id = hte.home_id
        LEFT JOIN practice_training_entry pte ON pte.training_id = tb.id
        LEFT JOIN practice_entry pe ON pe.id = pte.practice_id
        LEFT JOIN training_department_time_limits_connection tdtl ON tdtl.training_department_id = tbd.id AND tdtl.active = true
        LEFT JOIN scenario_time_limits_resource stlr ON stlr.id = tdtl.scenario_time_limits_id AND stlr.active = true
        LEFT JOIN training_department_scenarios_connection tsc ON tsc.training_department_id = tbd.id AND tsc.active = true
        LEFT JOIN training_department_rubrics_connection trc ON trc.training_department_id = tbd.id AND trc.active = true
        LEFT JOIN training_department_problem_statements_connection tpsc ON tpsc.training_department_id = tbd.id AND tpsc.active = true
        LEFT JOIN training_department_personas_connection tpc ON tpc.training_department_id = tbd.id AND tpc.active = true
        LEFT JOIN training_department_objectives_connection toc ON toc.training_department_id = tbd.id AND toc.active = true
        LEFT JOIN training_department_questions_connection tqc ON tqc.training_department_id = tbd.id AND tqc.active = true
        LEFT JOIN training_department_options_connection topt ON topt.training_department_id = tbd.id AND topt.active = true
        LEFT JOIN training_department_images_connection tic ON tic.training_department_id = tbd.id AND tic.active = true
        LEFT JOIN training_department_videos_connection tvc ON tvc.training_department_id = tbd.id AND tvc.active = true
        LEFT JOIN training_department_documents_connection tdc ON tdc.training_department_id = tbd.id AND tdc.active = true
        LEFT JOIN training_department_standard_groups_connection tsgc ON tsgc.training_department_id = tbd.id AND tsgc.active = true
        LEFT JOIN training_department_standards_connection tsc2 ON tsc2.training_department_id = tbd.id AND tsc2.active = true
        WHERE tbd.id = ANY(training_department_ids)
          AND tbd.active = true
        GROUP BY
            tbd.id,
            he.copy_paste_allowed, pe.copy_paste_allowed,
            he.text_enabled, pe.text_enabled,
            he.audio_enabled, pe.audio_enabled,
            he.hints_enabled, pe.hints_enabled,
            he.show_images, pe.show_images,
            he.show_objectives, pe.show_objectives,
            he.show_problem_statement, pe.show_problem_statement
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    training_department_id,
                    copy_paste_allowed, text_enabled, audio_enabled, hints_enabled,
                    show_images, show_objectives, show_problem_statement,
                    time_limit_seconds, negative,
                    scenario_id, rubric_id, problem_statement_id,
                    persona_ids, objective_ids, question_ids, option_ids,
                    image_ids, video_ids, document_ids,
                    standard_group_ids, standard_ids
                )::types.q_get_training_config_v4_item
            ),
            ARRAY[]::types.q_get_training_config_v4_item[]
        ) AS items
        FROM config
    )
    SELECT items FROM items_agg;
$$;
