-- Indexes for materialized view: test_completion_mv
--

CREATE UNIQUE INDEX test_completion_mv_pk ON test_completion_mv (id);

CREATE INDEX test_completion_mv_created_at_idx ON test_completion_mv (created_at DESC);

CREATE INDEX test_completion_mv_invocation_id_idx ON test_completion_mv (invocation_id);
