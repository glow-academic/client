-- Materialized View: attempt_feedback_mv
-- Grain: One row per feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for simulation grades,
-- replacing the feedbacks_agg composite array in attempt_chat_mv.
--
-- Dependencies: attempt_feedback_entry, feedbacks_standards_connection

CREATE MATERIALIZED VIEW attempt_feedback_mv AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fsc.standard_id,
    fe.total::float AS total,
    fe.feedback,
    fe.created_at
FROM attempt_feedback_entry fe
LEFT JOIN feedbacks_standards_connection fsc ON fsc.feedbacks_id = fe.id
WHERE fe.active = TRUE
WITH NO DATA;
