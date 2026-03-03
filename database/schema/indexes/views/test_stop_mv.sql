-- Indexes for materialized view: test_stop_mv
--

CREATE UNIQUE INDEX test_stop_mv_pk ON test_stop_mv (id);

CREATE INDEX test_stop_mv_created_at_idx ON test_stop_mv (created_at DESC);

CREATE INDEX test_stop_mv_invocation_id_idx ON test_stop_mv (invocation_id);
