-- Indexes for materialized view: attempt_analysis_mv
--

CREATE UNIQUE INDEX attempt_analysis_mv_pk
    ON attempt_analysis_mv (analysis_id);

CREATE INDEX attempt_analysis_mv_grade_id_idx
    ON attempt_analysis_mv (grade_id);
