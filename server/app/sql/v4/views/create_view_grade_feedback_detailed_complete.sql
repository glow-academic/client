-- View: view_grade_feedback_detailed_complete
-- Layer 2 Context View: Latest grade per chat with full feedback details.
-- Aggregates feedbacks by standard with achievements and pass status.
-- Write to _entry tables, read from this _view.

CREATE OR REPLACE VIEW view_grade_feedback_detailed_complete AS
WITH
-- Get latest grade per chat
latest_grades AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.created_at AS grade_created_at,
        g.updated_at AS grade_updated_at,
        g.description AS grade_description,
        g.passed,
        g.score,
        g.time_taken,
        g.end_reason,
        g.rubric_grade_agent_id
    FROM grades_entry g
    WHERE g.active = true
    ORDER BY g.chat_id, g.created_at DESC
),
-- Get rubric connection for grades
grade_rubrics AS (
    SELECT
        lg.grade_id,
        COALESCE(
            -- Try general grades first
            (SELECT grc.rubrics_id FROM general_grades_rubrics_connection grc WHERE grc.grade_id = lg.grade_id),
            -- Then practice grades
            (SELECT grc.rubrics_id FROM practice_grades_rubrics_connection grc WHERE grc.grade_id = lg.grade_id)
        ) AS rubric_resource_id
    FROM latest_grades lg
),
-- Feedbacks with standard connections
feedbacks_with_standards AS (
    SELECT
        fe.id AS feedback_id,
        fe.grade_id,
        fe.total,
        fe.feedback,
        fe.created_at AS feedback_created_at,
        fsc.standard_id
    FROM feedbacks_entry fe
    LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
    WHERE fe.active = true
),
-- Aggregate feedbacks by grade
feedbacks_aggregated AS (
    SELECT
        fws.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'feedback_id', fws.feedback_id,
                    'standard_id', fws.standard_id,
                    'total', fws.total,
                    'feedback', fws.feedback
                )
                ORDER BY fws.feedback_created_at
            ),
            '[]'::jsonb
        ) AS feedbacks
    FROM feedbacks_with_standards fws
    GROUP BY fws.grade_id
),
-- Standard achievements (which standards were graded)
standard_achievements AS (
    SELECT
        fws.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'standard_id', fws.standard_id,
                    'achieved', true
                )
            ) FILTER (WHERE fws.standard_id IS NOT NULL),
            '[]'::jsonb
        ) AS achieved_standards
    FROM feedbacks_with_standards fws
    GROUP BY fws.grade_id
),
-- Feedback by standard (text feedback per standard)
feedback_by_standard AS (
    SELECT
        fws.grade_id,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'standard_id', fws.standard_id,
                    'feedback', fws.feedback
                )
            ) FILTER (WHERE fws.standard_id IS NOT NULL),
            '[]'::jsonb
        ) AS feedback_by_standard_id
    FROM feedbacks_with_standards fws
    GROUP BY fws.grade_id
)
SELECT
    lg.grade_id,
    lg.chat_id,
    lg.grade_created_at,
    lg.grade_updated_at,
    lg.grade_description,
    lg.passed,
    lg.score,
    lg.time_taken,
    lg.end_reason,
    lg.rubric_grade_agent_id,
    -- Rubric info
    gr.rubric_resource_id,
    -- Aggregated feedbacks
    COALESCE(fa.feedbacks, '[]'::jsonb) AS feedbacks,
    -- Standard achievements
    COALESCE(sa.achieved_standards, '[]'::jsonb) AS achieved_standards,
    -- Feedback by standard
    COALESCE(fbs.feedback_by_standard_id, '[]'::jsonb) AS feedback_by_standard_id
FROM latest_grades lg
LEFT JOIN grade_rubrics gr ON gr.grade_id = lg.grade_id
LEFT JOIN feedbacks_aggregated fa ON fa.grade_id = lg.grade_id
LEFT JOIN standard_achievements sa ON sa.grade_id = lg.grade_id
LEFT JOIN feedback_by_standard fbs ON fbs.grade_id = lg.grade_id;
