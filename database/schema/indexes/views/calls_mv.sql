-- Indexes for materialized view: calls_mv
--

CREATE UNIQUE INDEX calls_mv_pk
    ON calls_mv (call_id);

CREATE INDEX calls_mv_run_id_idx
    ON calls_mv (run_id);

CREATE INDEX calls_mv_uploads_id_idx
    ON calls_mv (uploads_id);

CREATE INDEX calls_mv_run_created_at_idx
    ON calls_mv (run_id, call_created_at);
