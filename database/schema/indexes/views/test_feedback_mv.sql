-- Indexes for materialized view: test_feedback_mv
--

CREATE UNIQUE INDEX test_feedback_mv_pk
    ON test_feedback_mv (feedback_id);

CREATE INDEX test_feedback_mv_grade_id_idx
    ON test_feedback_mv (grade_id);

CREATE INDEX test_feedback_mv_grade_id_created_at_idx
    ON test_feedback_mv (grade_id, created_at);
