-- Indexes for materialized view: reports_mv
--

CREATE UNIQUE INDEX reports_mv_pk ON reports_mv (id);

CREATE INDEX reports_mv_created_at_idx ON reports_mv (created_at DESC);

CREATE INDEX reports_mv_upload_id_idx ON reports_mv (upload_id);
