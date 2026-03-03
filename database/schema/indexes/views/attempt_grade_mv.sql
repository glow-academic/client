-- Indexes for materialized view: attempt_grade_mv
--

CREATE UNIQUE INDEX attempt_grade_mv_pk
    ON attempt_grade_mv (grade_id);

CREATE UNIQUE INDEX attempt_grade_mv_chat_id_uniq
    ON attempt_grade_mv (chat_id);

CREATE INDEX attempt_grade_mv_chat_id_idx
    ON attempt_grade_mv (chat_id);
