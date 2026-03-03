-- Indexes for materialized view: uploads_mv
--

CREATE UNIQUE INDEX uploads_mv_pk
    ON uploads_mv (uploads_id, upload_id);

CREATE INDEX uploads_mv_uploads_id_idx
    ON uploads_mv (uploads_id);

CREATE INDEX uploads_mv_upload_id_idx
    ON uploads_mv (upload_id);

CREATE INDEX uploads_mv_created_at_idx
    ON uploads_mv (created_at DESC);
