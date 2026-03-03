-- Indexes for materialized view: certificates_mv
--

CREATE UNIQUE INDEX certificates_mv_pk ON certificates_mv (id);

CREATE INDEX certificates_mv_created_at_idx ON certificates_mv (created_at DESC);

CREATE INDEX certificates_mv_upload_id_idx ON certificates_mv (upload_id);
