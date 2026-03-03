-- Indexes for materialized view: run_pricing_mv
--

CREATE UNIQUE INDEX run_pricing_mv_pk ON run_pricing_mv (id);

CREATE INDEX run_pricing_mv_created_at_idx ON run_pricing_mv (created_at DESC);

CREATE INDEX run_pricing_mv_run_id_idx ON run_pricing_mv (run_id);
