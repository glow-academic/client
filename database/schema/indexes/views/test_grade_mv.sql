-- Indexes for materialized view: test_grade_mv
--

CREATE UNIQUE INDEX test_grade_mv_pk ON test_grade_mv (id);

CREATE INDEX test_grade_mv_created_at_idx ON test_grade_mv (created_at DESC);

CREATE INDEX test_grade_mv_invocation_id_idx ON test_grade_mv (invocation_id);

CREATE INDEX test_grade_mv_run_id_idx ON test_grade_mv (run_id);
