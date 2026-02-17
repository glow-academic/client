-- Materialized View: mv_attempt_chats
-- Chat-level data for attempt detail views.

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'mv_attempt_chats'
    LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
    END LOOP;
END $$;

DROP MATERIALIZED VIEW IF EXISTS mv_attempt_chats CASCADE;

CREATE MATERIALIZED VIEW mv_attempt_chats AS
WITH
latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score AS grade_score,
        g.passed AS grade_passed,
        g.time_taken AS grade_time_taken,
        g.total_points AS grade_total_points,
        g.pass_points AS grade_pass_points
    FROM simulation_grades_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
),
subbundle_snapshot AS (
    SELECT
        tbd.id AS training_bundle_department_id,
        te.copy_paste_allowed,
        te.text_enabled,
        te.audio_enabled,
        te.hints_enabled,
        te.show_images,
        te.show_objectives,
        te.show_problem_statement,
        COALESCE(MAX(stlr.time_limit_seconds), 0)::int AS time_limit_seconds,
        COALESCE(BOOL_OR(stlr.negative), false) AS negative,
        -- singular picks (first by created_at)
        (ARRAY_AGG(tsc.scenarios_id ORDER BY tsc.created_at) FILTER (WHERE tsc.scenarios_id IS NOT NULL))[1] AS scenario_id,
        (ARRAY_AGG(trc.rubrics_id ORDER BY trc.created_at) FILTER (WHERE trc.rubrics_id IS NOT NULL))[1] AS rubric_id,
        (ARRAY_AGG(tpsc.problem_statements_id ORDER BY tpsc.created_at) FILTER (WHERE tpsc.problem_statements_id IS NOT NULL))[1] AS problem_statement_id,
        -- plural sets
        COALESCE(ARRAY_AGG(DISTINCT tpc.personas_id ORDER BY tpc.personas_id) FILTER (WHERE tpc.personas_id IS NOT NULL), ARRAY[]::uuid[]) AS persona_ids,
        COALESCE(ARRAY_AGG(DISTINCT toc.objectives_id ORDER BY toc.objectives_id) FILTER (WHERE toc.objectives_id IS NOT NULL), ARRAY[]::uuid[]) AS objective_ids,
        COALESCE(ARRAY_AGG(DISTINCT tqc.questions_id ORDER BY tqc.questions_id) FILTER (WHERE tqc.questions_id IS NOT NULL), ARRAY[]::uuid[]) AS question_ids,
        COALESCE(ARRAY_AGG(DISTINCT topt.options_id ORDER BY topt.options_id) FILTER (WHERE topt.options_id IS NOT NULL), ARRAY[]::uuid[]) AS option_ids,
        COALESCE(ARRAY_AGG(DISTINCT tic.images_id ORDER BY tic.images_id) FILTER (WHERE tic.images_id IS NOT NULL), ARRAY[]::uuid[]) AS image_ids,
        COALESCE(ARRAY_AGG(DISTINCT tvc.videos_id ORDER BY tvc.videos_id) FILTER (WHERE tvc.videos_id IS NOT NULL), ARRAY[]::uuid[]) AS video_ids,
        COALESCE(ARRAY_AGG(DISTINCT tdc.documents_id ORDER BY tdc.documents_id) FILTER (WHERE tdc.documents_id IS NOT NULL), ARRAY[]::uuid[]) AS document_ids,
        COALESCE(ARRAY_AGG(DISTINCT tsgc.standard_groups_id ORDER BY tsgc.standard_groups_id) FILTER (WHERE tsgc.standard_groups_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_group_ids,
        COALESCE(ARRAY_AGG(DISTINCT tsc2.standards_id ORDER BY tsc2.standards_id) FILTER (WHERE tsc2.standards_id IS NOT NULL), ARRAY[]::uuid[]) AS standard_ids
    FROM training_bundle_departments_entry tbd
    JOIN training_bundle_entry tb ON tb.id = tbd.training_bundle_id
    JOIN training_entry te ON te.id = tb.training_id
    LEFT JOIN training_bundle_departments_time_limits_connection tdtl ON tdtl.training_bundle_department_id = tbd.id AND tdtl.active = true
    LEFT JOIN scenario_time_limits_resource stlr ON stlr.id = tdtl.scenario_time_limits_id AND stlr.active = true
    LEFT JOIN training_bundle_departments_scenarios_connection tsc ON tsc.training_bundle_department_id = tbd.id AND tsc.active = true
    LEFT JOIN training_bundle_departments_rubrics_connection trc ON trc.training_bundle_department_id = tbd.id AND trc.active = true
    LEFT JOIN training_bundle_departments_problem_statements_connection tpsc ON tpsc.training_bundle_department_id = tbd.id AND tpsc.active = true
    LEFT JOIN training_bundle_departments_personas_connection tpc ON tpc.training_bundle_department_id = tbd.id AND tpc.active = true
    LEFT JOIN training_bundle_departments_objectives_connection toc ON toc.training_bundle_department_id = tbd.id AND toc.active = true
    LEFT JOIN training_bundle_departments_questions_connection tqc ON tqc.training_bundle_department_id = tbd.id AND tqc.active = true
    LEFT JOIN training_bundle_departments_options_connection topt ON topt.training_bundle_department_id = tbd.id AND topt.active = true
    LEFT JOIN training_bundle_departments_images_connection tic ON tic.training_bundle_department_id = tbd.id AND tic.active = true
    LEFT JOIN training_bundle_departments_videos_connection tvc ON tvc.training_bundle_department_id = tbd.id AND tvc.active = true
    LEFT JOIN training_bundle_departments_documents_connection tdc ON tdc.training_bundle_department_id = tbd.id AND tdc.active = true
    LEFT JOIN training_bundle_departments_standard_groups_connection tsgc ON tsgc.training_bundle_department_id = tbd.id AND tsgc.active = true
    LEFT JOIN training_bundle_departments_standards_connection tsc2 ON tsc2.training_bundle_department_id = tbd.id AND tsc2.active = true
    WHERE tbd.active = true
    GROUP BY
        tbd.id,
        te.copy_paste_allowed,
        te.text_enabled,
        te.audio_enabled,
        te.hints_enabled,
        te.show_images,
        te.show_objectives,
        te.show_problem_statement
),
legacy_rubric AS (
    SELECT DISTINCT ON (grc.grade_id)
        lg.chat_id,
        grc.rubrics_id AS rubric_id
    FROM latest_grade lg
    JOIN simulation_grades_rubrics_connection grc ON grc.grade_id = lg.grade_id
    ORDER BY grc.grade_id
),
base_chats AS (
    SELECT
        c.id AS chat_id,
        c.attempt_id,
        c.group_id,
        c.created_at AS chat_created_at,
        (EXISTS (SELECT 1 FROM simulation_completions_entry comp WHERE comp.chat_id = c.id AND comp.active = TRUE)) AS chat_completed,
        sb.scenario_id AS scenario_id,
        COALESCE(sb.rubric_id, lr.rubric_id) AS rubric_id,
        COALESCE(sb.copy_paste_allowed, true) AS copy_paste_allowed,
        COALESCE(sb.text_enabled, true) AS text_enabled,
        COALESCE(sb.audio_enabled, true) AS audio_enabled,
        COALESCE(sb.hints_enabled, true) AS hints_enabled,
        COALESCE(sb.show_images, true) AS show_images,
        COALESCE(sb.show_objectives, true) AS show_objectives,
        COALESCE(sb.show_problem_statement, true) AS show_problem_statement,
        COALESCE(sb.time_limit_seconds, 0) AS time_limit_seconds,
        COALESCE(sb.negative, false) AS negative,
        sb.problem_statement_id,
        COALESCE(sb.persona_ids, ARRAY[]::uuid[]) AS persona_ids,
        COALESCE(sb.objective_ids, ARRAY[]::uuid[]) AS objective_ids,
        COALESCE(sb.question_ids, ARRAY[]::uuid[]) AS question_ids,
        COALESCE(sb.option_ids, ARRAY[]::uuid[]) AS option_ids,
        COALESCE(sb.image_ids, ARRAY[]::uuid[]) AS image_ids,
        COALESCE(sb.video_ids, ARRAY[]::uuid[]) AS video_ids,
        COALESCE(sb.document_ids, ARRAY[]::uuid[]) AS document_ids,
        COALESCE(sb.standard_group_ids, ARRAY[]::uuid[]) AS standard_group_ids,
        COALESCE(sb.standard_ids, ARRAY[]::uuid[]) AS standard_ids,
        lg.grade_id
    FROM simulation_chats_entry c
    JOIN simulation_attempts_entry a ON a.id = c.attempt_id
    LEFT JOIN LATERAL (
        SELECT archived FROM simulation_archives_entry
        WHERE attempt_id = a.id AND active = TRUE ORDER BY created_at DESC LIMIT 1
    ) sa_archive ON true
    LEFT JOIN subbundle_snapshot sb ON sb.training_bundle_department_id = c.training_bundle_department_id
    LEFT JOIN latest_grade lg ON lg.chat_id = c.id
    LEFT JOIN legacy_rubric lr ON lr.chat_id = c.id
    WHERE c.active = TRUE
      AND a.active = TRUE
      AND COALESCE(sa_archive.archived, FALSE) = FALSE
)
SELECT
    bc.chat_id,
    bc.attempt_id,
    bc.group_id,
    bc.scenario_id,
    bc.rubric_id,
    bc.copy_paste_allowed,
    bc.text_enabled,
    bc.audio_enabled,
    bc.hints_enabled,
    bc.show_images,
    bc.show_objectives,
    bc.show_problem_statement,
    bc.time_limit_seconds,
    bc.negative,
    bc.chat_created_at,
    bc.chat_completed,
    lg.grade_score,
    lg.grade_passed,
    lg.grade_time_taken,
    lg.grade_total_points,
    lg.grade_pass_points,
    bc.problem_statement_id,
    bc.persona_ids,
    bc.objective_ids,
    bc.question_ids,
    bc.option_ids,
    bc.image_ids,
    bc.video_ids,
    bc.document_ids,
    bc.standard_group_ids,
    bc.standard_ids
FROM base_chats bc
LEFT JOIN latest_grade lg ON lg.chat_id = bc.chat_id
WITH NO DATA;

CREATE UNIQUE INDEX mv_attempt_chats_pk
    ON mv_attempt_chats (chat_id);

CREATE INDEX mv_attempt_chats_attempt_id_idx
    ON mv_attempt_chats (attempt_id);

CREATE INDEX mv_attempt_chats_scenario_id_idx
    ON mv_attempt_chats (scenario_id);

CREATE INDEX mv_attempt_chats_completed_idx
    ON mv_attempt_chats (chat_completed);

CREATE INDEX mv_attempt_chats_attempt_created_at_idx
    ON mv_attempt_chats (attempt_id, chat_created_at);

REFRESH MATERIALIZED VIEW mv_attempt_chats;
