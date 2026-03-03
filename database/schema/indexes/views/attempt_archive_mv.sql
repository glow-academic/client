-- Indexes for materialized view: attempt_archive_mv
--

CREATE UNIQUE INDEX attempt_archive_mv_pk ON attempt_archive_mv (id);

CREATE INDEX attempt_archive_mv_created_at_idx ON attempt_archive_mv (created_at DESC);

CREATE INDEX attempt_archive_mv_attempt_id_idx ON attempt_archive_mv (attempt_id);
