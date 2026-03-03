-- Indexes for materialized view: test_archive_mv
--

CREATE UNIQUE INDEX test_archive_mv_pk ON test_archive_mv (id);

CREATE INDEX test_archive_mv_created_at_idx ON test_archive_mv (created_at DESC);

CREATE INDEX test_archive_mv_test_id_idx ON test_archive_mv (test_id);
