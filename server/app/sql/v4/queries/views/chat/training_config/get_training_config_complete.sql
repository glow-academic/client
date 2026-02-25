-- ============================================================================
-- Query: get_training_config
-- Purpose: Fetch training department config by attempt_chat_ids
-- Section: VIEWS/CHAT/TRAINING_CONFIG
--
-- Replaces the subbundle_snapshot CTE from attempt_chat_mv.
-- Returns config flags + resource ID arrays per attempt_chat_id.
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
    attempt_chat_id uuid,
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
    persona_ids uuid[],
    -- Plural sets
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
    attempt_chat_ids uuid[]
)
RETURNS TABLE (
    items types.q_get_training_config_v4_item[]
)
LANGUAGE sql
STABLE
AS $$
    WITH config AS (
        SELECT
            tbd.id AS attempt_chat_id,
            tb.copy_paste_allowed,
            tb.text_enabled,
            tb.audio_enabled,
            tb.hints_enabled,
            tb.show_images,
            tb.show_objectives,
            tb.show_problem_statement,
            COALESCE(MAX(stlr.time_limit_seconds), 0)::int AS time_limit_seconds,
            COALESCE(BOOL_OR(stlr.negative), false) AS negative,
            -- singular picks (first by created_at)
            (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at) FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
            (ARRAY_AGG(trc.rubrics_id ORDER BY trc.created_at) FILTER (WHERE trc.rubrics_id IS NOT NULL))[1] AS rubric_id,
            (ARRAY_AGG(tpsc.problem_statements_id ORDER BY tpsc.created_at) FILTER (WHERE tpsc.problem_statements_id IS NOT NULL))[1] AS problem_statement_id,
            COALESCE(ARRAY_AGG(DISTINCT ppr.persona_id ORDER BY ppr.persona_id) FILTER (WHERE ppr.persona_id IS NOT NULL), ARRAY[]::uuid[]) AS persona_ids,
            -- plural sets
            COALESCE(ARRAY_AGG(DISTINCT toc.objectives_id ORDER BY toc.objectives_id) FILTER (WHERE toc.objectives_id IS NOT NULL), ARRAY[]::uuid[]) AS objective_ids,
            COALESCE(ARRAY_AGG(DISTINCT tqc.questions_id ORDER BY tqc.questions_id) FILTER (WHERE tqc.questions_id IS NOT NULL), ARRAY[]::uuid[]) AS question_ids,
            COALESCE(ARRAY_AGG(DISTINCT topt.options_id ORDER BY topt.options_id) FILTER (WHERE topt.options_id IS NOT NULL), ARRAY[]::uuid[]) AS option_ids,
            COALESCE(ARRAY_AGG(DISTINCT tic.images_id ORDER BY tic.images_id) FILTER (WHERE tic.images_id IS NOT NULL), ARRAY[]::uuid[]) AS image_ids,
            COALESCE(ARRAY_AGG(DISTINCT tvc.videos_id ORDER BY tvc.videos_id) FILTER (WHERE tvc.videos_id IS NOT NULL), ARRAY[]::uuid[]) AS video_ids,
            COALESCE(ARRAY_AGG(DISTINCT tdc.documents_id ORDER BY tdc.documents_id) FILTER (WHERE tdc.documents_id IS NOT NULL), ARRAY[]::uuid[]) AS document_ids,
            COALESCE(ARRAY_AGG(DISTINCT tsgc.standard_groups_id ORDER BY tsgc.standard_groups_id) FILTER (WHERE tsgc.standard_groups_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_group_ids,
            COALESCE(ARRAY_AGG(DISTINCT tsc2.standards_id ORDER BY tsc2.standards_id) FILTER (WHERE tsc2.standards_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_ids
        FROM attempt_chat_entry tbd
        JOIN chat_entry tb ON tb.id = tbd.chat_id
        LEFT JOIN home_chat_entry hte ON hte.chat_id = tb.id
        LEFT JOIN practice_chat_entry pte ON pte.chat_id = tb.id
        LEFT JOIN chat_scenario_time_limits_connection ctlc ON ctlc.chat_id = tb.id AND ctlc.active = true
        LEFT JOIN scenario_time_limits_resource stlr ON stlr.id = ctlc.scenario_time_limits_id AND stlr.active = true
        LEFT JOIN chat_scenarios_connection tsc ON tsc.chat_id = tb.id AND tsc.active = true
        LEFT JOIN attempt_chat_rubrics_connection trc ON trc.attempt_chat_id = tbd.id AND trc.active = true
        LEFT JOIN attempt_chat_problem_statements_connection tpsc ON tpsc.attempt_chat_id = tbd.id AND tpsc.active = true
        LEFT JOIN attempt_chat_objectives_connection toc ON toc.attempt_chat_id = tbd.id AND toc.active = true
        LEFT JOIN attempt_chat_questions_connection tqc ON tqc.attempt_chat_id = tbd.id AND tqc.active = true
        LEFT JOIN attempt_chat_options_connection topt ON topt.attempt_chat_id = tbd.id AND topt.active = true
        LEFT JOIN attempt_chat_images_connection tic ON tic.attempt_chat_id = tbd.id AND tic.active = true
        LEFT JOIN attempt_chat_videos_connection tvc ON tvc.attempt_chat_id = tbd.id AND tvc.active = true
        LEFT JOIN attempt_chat_documents_connection tdc ON tdc.attempt_chat_id = tbd.id AND tdc.active = true
        LEFT JOIN attempt_chat_standard_groups_connection tsgc ON tsgc.attempt_chat_id = tbd.id AND tsgc.active = true
        LEFT JOIN attempt_chat_standards_connection tsc2 ON tsc2.attempt_chat_id = tbd.id AND tsc2.active = true
        LEFT JOIN home_profile_personas_connection hppc ON hppc.home_id = hte.home_id AND hppc.active = true
        LEFT JOIN practice_profile_personas_connection pppc ON pppc.practice_id = pte.practice_id AND pppc.active = true
        LEFT JOIN profile_personas_resource ppr ON ppr.id = COALESCE(hppc.profile_personas_id, pppc.profile_personas_id) AND ppr.active = true
        WHERE tbd.id = ANY(attempt_chat_ids)
          AND tbd.active = true
        GROUP BY
            tbd.id,
            tb.copy_paste_allowed, tb.text_enabled, tb.audio_enabled, tb.hints_enabled,
            tb.show_images, tb.show_objectives, tb.show_problem_statement
    ),
    items_agg AS (
        SELECT COALESCE(
            ARRAY_AGG(
                (
                    attempt_chat_id,
                    copy_paste_allowed, text_enabled, audio_enabled, hints_enabled,
                    show_images, show_objectives, show_problem_statement,
                    time_limit_seconds, negative,
                    scenario_id, rubric_id, problem_statement_id, persona_ids,
                    objective_ids, question_ids, option_ids,
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
