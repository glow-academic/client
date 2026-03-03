-- Indexes for materialized view: uploads_completions_mv
--

CREATE UNIQUE INDEX uploads_completions_mv_pk ON uploads_completions_mv (id);

CREATE INDEX uploads_completions_mv_created_at_idx ON uploads_completions_mv (created_at DESC);

CREATE INDEX uploads_completions_mv_upload_id_idx ON uploads_completions_mv (upload_id);
