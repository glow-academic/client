-- Materialized View: test_feedback_mv
-- Grain: One row per benchmark feedback entry per grade
--
-- Purpose: Flat denormalized feedback rows for benchmark grades,
-- replacing the feedbacks_agg composite array in test_invocation_mv.
--
-- Dependencies: test_feedback_entry

CREATE MATERIALIZED VIEW test_feedback_mv AS
SELECT
    fe.id AS feedback_id,
    fe.grade_id,
    fe.total,
    fe.feedback,
    fe.total_points,
    fe.pass_points,
    fe.created_at
FROM test_feedback_entry fe
WHERE fe.active = TRUE
WITH NO DATA;
