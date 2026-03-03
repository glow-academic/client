-- Indexes for materialized view: tokens_mv
--

CREATE UNIQUE INDEX tokens_mv_pk ON tokens_mv (id);

CREATE INDEX tokens_mv_created_at_idx ON tokens_mv (created_at DESC);

CREATE INDEX tokens_mv_run_id_idx ON tokens_mv (run_id);
