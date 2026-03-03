-- Indexes for materialized view: debug_info_mv
--

CREATE UNIQUE INDEX debug_info_mv_pk ON debug_info_mv (id);

CREATE INDEX debug_info_mv_created_at_idx ON debug_info_mv (created_at DESC);

CREATE INDEX debug_info_mv_call_id_idx ON debug_info_mv (call_id);

CREATE INDEX debug_info_mv_run_id_idx ON debug_info_mv (run_id);

CREATE INDEX debug_info_mv_mcp_idx ON debug_info_mv (mcp);
