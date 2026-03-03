-- Indexes for materialized view: videos_mv
--

CREATE UNIQUE INDEX videos_mv_pk
    ON videos_mv (video_id);

CREATE INDEX videos_mv_uploads_id_idx
    ON videos_mv (uploads_id);

CREATE INDEX videos_mv_created_at_idx
    ON videos_mv (created_at DESC);
