-- Indexes for materialized view: files_mv
--

CREATE UNIQUE INDEX files_mv_pk
    ON files_mv (file_id);

CREATE INDEX files_mv_uploads_id_idx
    ON files_mv (uploads_id);

CREATE INDEX files_mv_mime_type_idx
    ON files_mv (mime_type);

CREATE INDEX files_mv_created_at_idx
    ON files_mv (created_at DESC);
