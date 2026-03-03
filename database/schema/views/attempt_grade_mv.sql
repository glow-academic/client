-- Materialized View: attempt_grade_mv
-- Grain: One row per chat (latest grade only, using DISTINCT ON)
--
-- Purpose: Flat denormalized latest grade per chat for simulation attempts,
-- replacing the latest_grade + legacy_rubric CTEs in attempt_chat_mv.
--
-- Dependencies: attempt_grade_entry, attempt_grade_rubrics_connection

CREATE MATERIALIZED VIEW attempt_grade_mv AS
WITH latest_grade AS (
    SELECT DISTINCT ON (g.chat_id)
        g.id AS grade_id,
        g.chat_id,
        g.score,
        g.passed,
        g.time_taken,
        g.created_at
    FROM attempt_grade_entry g
    WHERE g.active = TRUE
    ORDER BY g.chat_id, g.created_at DESC
)
SELECT
    lg.grade_id,
    lg.chat_id,
    lg.score::float AS score,
    lg.passed,
    lg.time_taken,
    r.total_points,
    r.pass_points,
    acrc.rubrics_id AS rubric_id,
    lg.created_at
FROM latest_grade lg
LEFT JOIN attempt_chat_entry ace ON ace.id = lg.chat_id AND ace.active = TRUE
LEFT JOIN attempt_chat_rubrics_connection acrc ON acrc.attempt_chat_id = ace.id AND acrc.active = TRUE
LEFT JOIN rubrics_resource r ON r.id = acrc.rubrics_id
WITH NO DATA;
