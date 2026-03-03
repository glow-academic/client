-- Indexes for materialized view: attempt_feedback_mv
--

CREATE UNIQUE INDEX attempt_feedback_mv_pk
    ON attempt_feedback_mv (feedback_id);

CREATE INDEX attempt_feedback_mv_grade_id_idx
    ON attempt_feedback_mv (grade_id);

CREATE INDEX attempt_feedback_mv_grade_id_created_at_idx
    ON attempt_feedback_mv (grade_id, created_at);
